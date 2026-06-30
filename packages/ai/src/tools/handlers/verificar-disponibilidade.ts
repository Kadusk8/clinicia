import { db, schema } from '@crm-clinicas/db';
import { and, eq, inArray, lt, gt } from 'drizzle-orm';
import type { WorkingHours, DayOfWeek } from '@crm-clinicas/shared';
import type { ToolContext } from '../context.js';

const DAY_KEYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
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

  // 4. Generate and filter slots per professional
  const now = new Date();
  const result: Array<{
    professionalId: string;
    professionalName: string;
    slots: Array<{ startsAt: string; endsAt: string }>;
  }> = [];

  for (const prof of professionalsToCheck) {
    const profConflicts = conflicts.filter((c) => c.professionalId === prof.id);
    const slots: Array<{ startsAt: string; endsAt: string }> = [];

    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= effectiveTo && slots.length < MAX_SLOTS_PER_PROFESSIONAL) {
      const dayKey = DAY_KEYS[cursor.getDay()]!;
      const dayIntervals = prof.workingHours[dayKey] ?? [];

      for (const interval of dayIntervals) {
        const [startH = 0, startM = 0] = interval.start.split(':').map(Number);
        const [endH = 0, endM = 0] = interval.end.split(':').map(Number);

        const dayStart = new Date(cursor);
        dayStart.setHours(startH, startM, 0, 0);

        const dayEnd = new Date(cursor);
        dayEnd.setHours(endH, endM, 0, 0);

        let slotStart = new Date(Math.max(dayStart.getTime(), fromDate.getTime()));

        while (
          slotStart.getTime() + slotDurationMs <= dayEnd.getTime() &&
          slots.length < MAX_SLOTS_PER_PROFESSIONAL
        ) {
          const slotEnd = new Date(slotStart.getTime() + slotDurationMs);

          // Skip past slots
          if (slotEnd <= now) {
            slotStart = slotEnd;
            continue;
          }

          // Check for conflicts
          const hasConflict = profConflicts.some(
            (c) => c.startsAt < slotEnd && c.endsAt > slotStart,
          );

          if (!hasConflict) {
            slots.push({ startsAt: slotStart.toISOString(), endsAt: slotEnd.toISOString() });
          }

          slotStart = slotEnd;
        }

        if (slots.length >= MAX_SLOTS_PER_PROFESSIONAL) break;
      }

      cursor.setDate(cursor.getDate() + 1);
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
