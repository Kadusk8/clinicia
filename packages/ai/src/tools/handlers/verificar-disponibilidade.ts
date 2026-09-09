import { db, schema } from '@crm-clinicas/db';
import { and, eq, inArray, lt, gt } from 'drizzle-orm';
import type { WorkingHours } from '@crm-clinicas/shared';
import { brasiliaDateParts, brasiliaInstant, brasiliaLabel } from '@crm-clinicas/shared';
import type { ToolContext } from '../context.js';
import { getGoogleBusyIntervals } from '../../google-calendar-sync.js';
import { invalidIdError } from '../validate.js';

const MAX_DAYS = 30;
const MAX_SLOTS_PER_PROFESSIONAL = 10;

interface ProfessionalToCheck {
  id: string;
  name: string;
  workingHours: WorkingHours;
}

export async function verificarDisponibilidade(
  input: { serviceId: string; professionalId?: string; from: string; to: string },
  context: ToolContext,
): Promise<string> {
  const serviceIdError = invalidIdError('serviceId', input.serviceId);
  if (serviceIdError) return serviceIdError;
  // professionalId is optional — "buscar em todos os profissionais" é um null/undefined
  // legítimo, só valida quando um valor de fato foi passado.
  if (input.professionalId != null) {
    const professionalIdError = invalidIdError('professionalId', input.professionalId);
    if (professionalIdError) return professionalIdError;
  }

  const fromDate = new Date(input.from);
  const toDate = new Date(input.to);

  // Limit range to MAX_DAYS
  const maxTo = new Date(fromDate);
  maxTo.setDate(maxTo.getDate() + MAX_DAYS);
  const effectiveTo = toDate < maxTo ? toDate : maxTo;

  // 1. Get service to know duration
  const [service] = await db
    .select()
    .from(schema.services)
    .where(
      and(
        eq(schema.services.id, input.serviceId),
        eq(schema.services.clinicId, context.clinicId),
      ),
    )
    .limit(1);

  if (!service) {
    return JSON.stringify({ error: 'Serviço não encontrado.' });
  }

  const slotDurationMs = service.durationMin * 60 * 1000;

  // 2. Resolve professionals
  let professionalsToCheck: ProfessionalToCheck[] = [];

  if (input.professionalId) {
    const [prof] = await db
      .select()
      .from(schema.professionals)
      .where(
        and(
          eq(schema.professionals.id, input.professionalId),
          eq(schema.professionals.clinicId, context.clinicId),
        ),
      )
      .limit(1);

    if (!prof) {
      return JSON.stringify({ error: 'Profissional não encontrado.' });
    }

    professionalsToCheck = [
      { id: prof.id, name: prof.name, workingHours: (prof.workingHours as WorkingHours) ?? {} },
    ];
  } else {
    // Find all professionals that offer this service in this clinic
    const rows = await db
      .select({ prof: schema.professionals })
      .from(schema.professionalServices)
      .innerJoin(
        schema.professionals,
        eq(schema.professionalServices.professionalId, schema.professionals.id),
      )
      .where(
        and(
          eq(schema.professionalServices.serviceId, input.serviceId),
          eq(schema.professionals.clinicId, context.clinicId),
        ),
      );

    professionalsToCheck = rows.map((r) => ({
      id: r.prof.id,
      name: r.prof.name,
      workingHours: (r.prof.workingHours as WorkingHours) ?? {},
    }));
  }

  if (professionalsToCheck.length === 0) {
    return JSON.stringify({ error: 'Nenhum profissional disponível para este serviço.' });
  }

  // 3. Fetch conflicting appointments in the range
  const profIds = professionalsToCheck.map((p) => p.id);
  const conflicts = await db
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.clinicId, context.clinicId),
        inArray(schema.appointments.professionalId, profIds),
        inArray(schema.appointments.status, ['scheduled', 'confirmed']),
        lt(schema.appointments.startsAt, effectiveTo),
        gt(schema.appointments.endsAt, fromDate),
      ),
    );

  // 3b. Fetch busy blocks from the clinic's shared Google Calendar (if connected).
  // Single calendar for the whole clinic, so it applies to every professional.
  const googleBusy = await getGoogleBusyIntervals(
    context.clinicId,
    fromDate.toISOString(),
    effectiveTo.toISOString(),
  );
  const googleBusyIntervals = googleBusy.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));

  // 4. Generate and filter slots per professional
  const now = new Date();
  const result: Array<{
    professionalId: string;
    professionalName: string;
    slots: Array<{ startsAt: string; endsAt: string; horarioBrasilia: string }>;
  }> = [];

  for (const prof of professionalsToCheck) {
    const profConflicts = conflicts.filter((c) => c.professionalId === prof.id);
    const slots: Array<{ startsAt: string; endsAt: string; horarioBrasilia: string }> = [];

    let cursorInstant = fromDate;

    for (let dayOffset = 0; dayOffset <= MAX_DAYS && slots.length < MAX_SLOTS_PER_PROFESSIONAL; dayOffset++) {
      const { year, month, day, weekday } = brasiliaDateParts(cursorInstant);
      const dayIntervals = prof.workingHours[weekday] ?? [];

      for (const interval of dayIntervals) {
        const [startH = 0, startM = 0] = interval.start.split(':').map(Number);
        const [endH = 0, endM = 0] = interval.end.split(':').map(Number);

        const dayStart = brasiliaInstant(year, month, day, startH, startM);
        const dayEnd = brasiliaInstant(year, month, day, endH, endM);

        let slotStart = new Date(Math.max(dayStart.getTime(), fromDate.getTime()));

        while (
          slotStart.getTime() + slotDurationMs <= dayEnd.getTime() &&
          slotStart.getTime() + slotDurationMs <= effectiveTo.getTime() &&
          slots.length < MAX_SLOTS_PER_PROFESSIONAL
        ) {
          const slotEnd = new Date(slotStart.getTime() + slotDurationMs);

          // Skip past slots
          if (slotEnd <= now) {
            slotStart = slotEnd;
            continue;
          }

          // Check for conflicts (internal appointments + shared Google Calendar busy blocks)
          const hasConflict =
            profConflicts.some((c) => c.startsAt < slotEnd && c.endsAt > slotStart) ||
            googleBusyIntervals.some((b) => b.start < slotEnd && b.end > slotStart);

          if (!hasConflict) {
            slots.push({
              startsAt: slotStart.toISOString(),
              endsAt: slotEnd.toISOString(),
              horarioBrasilia: brasiliaLabel(slotStart),
            });
          }

          slotStart = slotEnd;
        }

        if (slots.length >= MAX_SLOTS_PER_PROFESSIONAL) break;
      }

      // Meio-dia de Brasília do dia atual + 24h cai sempre no dia seguinte certo,
      // sem depender do timezone do processo.
      const nextDay = new Date(brasiliaInstant(year, month, day, 12, 0).getTime() + 24 * 60 * 60 * 1000);
      if (nextDay > effectiveTo) break;
      cursorInstant = nextDay;
    }

    if (slots.length > 0) {
      result.push({ professionalId: prof.id, professionalName: prof.name, slots });
    }
  }

  if (result.length === 0) {
    return JSON.stringify({ available: false, message: 'Nenhum horário disponível no período solicitado.' });
  }

  return JSON.stringify({ available: true, professionals: result });
}
