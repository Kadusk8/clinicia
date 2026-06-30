import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function cancelarOuRemarcar(
  input: {
    appointmentId: string;
    action: 'cancel' | 'reschedule';
    newStartsAt?: string;
    reason?: string;
  },
  context: ToolContext,
): Promise<string> {
  // Verify ownership
  const [apt] = await db
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.id, input.appointmentId),
        eq(schema.appointments.clinicId, context.clinicId),
      ),
    )
    .limit(1);

  if (!apt) {
    return JSON.stringify({ success: false, error: 'Agendamento não encontrado.' });
  }

  if (apt.status === 'cancelled') {
    return JSON.stringify({ success: false, error: 'Este agendamento já foi cancelado.' });
  }

  // Cancel pending follow-ups for this appointment
  const cancelFollowUps = () =>
    db
      .update(schema.followUps)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(schema.followUps.appointmentId, input.appointmentId),
          eq(schema.followUps.status, 'pending'),
        ),
      );

  if (input.action === 'cancel') {
    await db
      .update(schema.appointments)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: input.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.appointments.id, input.appointmentId));

    await cancelFollowUps();

    return JSON.stringify({ success: true, action: 'cancelled' });
  }

  // Reschedule
  if (!input.newStartsAt) {
    return JSON.stringify({ success: false, error: 'Nova data/hora é obrigatória para remarcar.' });
  }

  const [service] = await db
    .select({ durationMin: schema.services.durationMin })
    .from(schema.services)
    .where(eq(schema.services.id, apt.serviceId))
    .limit(1);

  const durationMin = service?.durationMin ?? 30;
  const newStartsAt = new Date(input.newStartsAt);
  const newEndsAt = new Date(newStartsAt.getTime() + durationMin * 60 * 1000);

  await db
    .update(schema.appointments)
    .set({ startsAt: newStartsAt, endsAt: newEndsAt, status: 'scheduled', updatedAt: new Date() })
    .where(eq(schema.appointments.id, input.appointmentId));

  // Cancel old follow-ups and create new ones
  await cancelFollowUps();

  const now = new Date();
  const followUpsToInsert = [];

  const reminder24h = new Date(newStartsAt.getTime() - 24 * 60 * 60 * 1000);
  if (reminder24h > now) {
    followUpsToInsert.push({
      clinicId: context.clinicId,
      patientId: apt.patientId,
      appointmentId: apt.id,
      type: 'reminder_24h' as const,
      templateKey: 'reminder_24h',
      scheduledFor: reminder24h,
      status: 'pending',
    });
  }

  const reminder2h = new Date(newStartsAt.getTime() - 2 * 60 * 60 * 1000);
  if (reminder2h > now) {
    followUpsToInsert.push({
      clinicId: context.clinicId,
      patientId: apt.patientId,
      appointmentId: apt.id,
      type: 'reminder_2h' as const,
      templateKey: 'reminder_2h',
      scheduledFor: reminder2h,
      status: 'pending',
    });
  }

  if (followUpsToInsert.length > 0) {
    await db.insert(schema.followUps).values(followUpsToInsert);
  }

  return JSON.stringify({
    success: true,
    action: 'rescheduled',
    newStartsAt: newStartsAt.toISOString(),
    newEndsAt: newEndsAt.toISOString(),
  });
}
