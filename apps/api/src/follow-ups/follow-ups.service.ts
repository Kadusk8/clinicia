import { Injectable, Logger } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, lte, desc, sql } from 'drizzle-orm';

// Follow-up message templates
const TEMPLATES: Record<string, (patientName: string, clinicName: string, date: string, service: string) => string> = {
  reminder_24h: (patient, clinic, date, service) =>
    `Olá ${patient}! 😊 Lembrando que amanhã você tem uma consulta de *${service}* na *${clinic}* às *${date}*. Confirma presença? Responda SIM ou NÃO.`,

  reminder_2h: (patient, clinic, date, service) =>
    `Oi ${patient}! Sua consulta de *${service}* na *${clinic}* é daqui a *2 horas* (${date}). Estamos te esperando! 🏥`,

  post_visit: (patient, clinic) =>
    `Olá ${patient}! 😊 Como foi sua experiência na *${clinic}*? De 0 a 10, que nota você daria para o nosso atendimento? Sua opinião é muito importante para nós! ⭐`,

  reactivation_30d: (patient, clinic) =>
    `Oi ${patient}! Faz um tempo que não nos vemos. 😊 A *${clinic}* tem novidades e gostaria de te receber novamente. Quer agendar uma consulta? Responda SIM!`,

  birthday: (patient, clinic) =>
    `Feliz aniversário, ${patient}! 🎂🎉 A equipe da *${clinic}* deseja muitas felicidades! Que tal um check-up de presente? 😉`,
};

@Injectable()
export class FollowUpsService {
  private readonly logger = new Logger(FollowUpsService.name);

  // ==========================================
  // CRUD
  // ==========================================

  async findByClinic(clinicId: string) {
    return db
      .select()
      .from(schema.followUps)
      .where(eq(schema.followUps.clinicId, clinicId))
      .orderBy(desc(schema.followUps.scheduledFor));
  }

  async findPending(clinicId: string) {
    return db
      .select()
      .from(schema.followUps)
      .where(
        and(
          eq(schema.followUps.clinicId, clinicId),
          eq(schema.followUps.status, 'pending'),
        ),
      )
      .orderBy(schema.followUps.scheduledFor);
  }

  async findDueFollowUps() {
    // Find all follow-ups that are pending and scheduled_for <= now
    return db
      .select({
        followUp: schema.followUps,
        patient: schema.patients,
        clinic: schema.clinics,
        appointment: schema.appointments,
      })
      .from(schema.followUps)
      .innerJoin(schema.patients, eq(schema.followUps.patientId, schema.patients.id))
      .innerJoin(schema.clinics, eq(schema.followUps.clinicId, schema.clinics.id))
      .leftJoin(schema.appointments, eq(schema.followUps.appointmentId, schema.appointments.id))
      .where(
        and(
          eq(schema.followUps.status, 'pending'),
          lte(schema.followUps.scheduledFor, new Date()),
        ),
      )
      .orderBy(schema.followUps.scheduledFor)
      .limit(50);
  }

  // ==========================================
  // Auto-create follow-ups for appointment
  // ==========================================

  async createForAppointment(clinicId: string, appointmentId: string, patientId: string, startsAt: Date) {
    this.logger.log(`Creating follow-ups for appointment ${appointmentId}`);

    const followUps = [
      {
        clinicId,
        patientId,
        appointmentId,
        type: 'reminder_24h',
        templateKey: 'reminder_24h',
        scheduledFor: new Date(startsAt.getTime() - 24 * 60 * 60 * 1000), // 24h before
        status: 'pending',
      },
      {
        clinicId,
        patientId,
        appointmentId,
        type: 'reminder_2h',
        templateKey: 'reminder_2h',
        scheduledFor: new Date(startsAt.getTime() - 2 * 60 * 60 * 1000), // 2h before
        status: 'pending',
      },
      {
        clinicId,
        patientId,
        appointmentId,
        type: 'post_visit',
        templateKey: 'post_visit',
        scheduledFor: new Date(startsAt.getTime() + 48 * 60 * 60 * 1000), // 48h after
        status: 'pending',
      },
    ];

    // Filter out follow-ups scheduled in the past
    const validFollowUps = followUps.filter((f) => f.scheduledFor > new Date());

    if (validFollowUps.length === 0) {
      this.logger.warn('All follow-ups would be in the past, skipping');
      return [];
    }

    const result = await db
      .insert(schema.followUps)
      .values(validFollowUps)
      .returning();

    this.logger.log(`Created ${result.length} follow-ups`);
    return result;
  }

  // ==========================================
  // Cancel follow-ups for cancelled appointment
  // ==========================================

  async cancelForAppointment(appointmentId: string) {
    return db
      .update(schema.followUps)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(schema.followUps.appointmentId, appointmentId),
          eq(schema.followUps.status, 'pending'),
        ),
      )
      .returning();
  }

  // ==========================================
  // Generate message from template
  // ==========================================

  generateMessage(
    templateKey: string,
    patientName: string,
    clinicName: string,
    appointmentDate?: string,
    serviceName?: string,
  ): string {
    const template = TEMPLATES[templateKey];
    if (!template) {
      return `Olá ${patientName}! A ${clinicName} tem uma mensagem para você.`;
    }
    return template(patientName, clinicName, appointmentDate || '', serviceName || 'consulta');
  }

  // ==========================================
  // Mark as sent
  // ==========================================

  async markAsSent(id: string) {
    return db
      .update(schema.followUps)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(schema.followUps.id, id))
      .returning();
  }

  async markAsFailed(id: string) {
    return db
      .update(schema.followUps)
      .set({ status: 'failed' })
      .where(eq(schema.followUps.id, id))
      .returning();
  }

  // ==========================================
  // Stats
  // ==========================================

  async getStats(clinicId: string) {
    const [pending, sent, total] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.followUps)
        .where(and(eq(schema.followUps.clinicId, clinicId), eq(schema.followUps.status, 'pending'))),
      db.select({ count: sql<number>`count(*)` }).from(schema.followUps)
        .where(and(eq(schema.followUps.clinicId, clinicId), eq(schema.followUps.status, 'sent'))),
      db.select({ count: sql<number>`count(*)` }).from(schema.followUps)
        .where(eq(schema.followUps.clinicId, clinicId)),
    ]);

    return {
      pending: Number(pending[0]?.count ?? 0),
      sent: Number(sent[0]?.count ?? 0),
      total: Number(total[0]?.count ?? 0),
    };
  }
}
