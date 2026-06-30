import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function agendarConsulta(
  input: {
    patientId: string;
    serviceId: string;
    professionalId: string;
    startsAt: string;
  },
  context: ToolContext,
): Promise<string> {
  // Validate service
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
    return JSON.stringify({ success: false, error: 'Serviço não encontrado.' });
  }

  // Validate patient
  const [patient] = await db
    .select({ id: schema.patients.id })
    .from(schema.patients)
    .where(
      and(
        eq(schema.patients.id, input.patientId),
        eq(schema.patients.clinicId, context.clinicId),
      ),
    )
    .limit(1);

  if (!patient) {
    return JSON.stringify({ success: false, error: 'Paciente não encontrado.' });
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60 * 1000);

  // Create appointment
  const inserted = await db
    .insert(schema.appointments)
    .values({
      clinicId: context.clinicId,
      patientId: input.patientId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      startsAt,
      endsAt,
      status: 'scheduled',
      source: 'whatsapp_agent',
    })
    .returning();

  const appointment = inserted[0];
  if (!appointment) {
    return JSON.stringify({ success: false, error: 'Falha ao criar agendamento.' });
  }

  // Schedule follow-ups (only schedule if in the future)
  const now = new Date();
  const followUpsToInsert = [];

  const reminder24h = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  if (reminder24h > now) {
    followUpsToInsert.push({
      clinicId: context.clinicId,
      patientId: input.patientId,
      appointmentId: appointment.id,
      type: 'reminder_24h' as const,
      templateKey: 'reminder_24h',
      scheduledFor: reminder24h,
      status: 'pending',
    });
  }

  const reminder2h = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
  if (reminder2h > now) {
    followUpsToInsert.push({
      clinicId: context.clinicId,
      patientId: input.patientId,
      appointmentId: appointment.id,
      type: 'reminder_2h' as const,
      templateKey: 'reminder_2h',
      scheduledFor: reminder2h,
      status: 'pending',
    });
  }

  if (followUpsToInsert.length > 0) {
    await db.insert(schema.followUps).values(followUpsToInsert);
  }

  const startsAtFormatted = startsAt.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return JSON.stringify({
    success: true,
    appointment: {
      id: appointment.id,
      service: service.name,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      startsAtFormatted,
      status: appointment.status,
    },
  });
}
