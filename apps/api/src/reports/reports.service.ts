import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';

@Injectable()
export class ReportsService {
  async getOverview(clinicId: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      totalPatients,
      appointmentsToday,
      activeConversations,
      upcomingAppointments,
      recentConversations,
    ] = await Promise.all([
      // Total patients
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.patients)
        .where(eq(schema.patients.clinicId, clinicId))
        .then((r) => Number(r[0]?.count ?? 0)),

      // Appointments today (scheduled + confirmed)
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.clinicId, clinicId),
            gte(schema.appointments.startsAt, startOfDay),
            lte(schema.appointments.startsAt, endOfDay),
          ),
        )
        .then((r) => Number(r[0]?.count ?? 0)),

      // Active conversations
      db
        .select({
          total: sql<number>`count(*)`,
          unread: sql<number>`sum(coalesce(${schema.conversations.unreadCount}, 0))`,
        })
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.clinicId, clinicId),
            sql`${schema.conversations.status} != 'closed'`,
          ),
        )
        .then((r) => ({
          count: Number(r[0]?.total ?? 0),
          unreadCount: Number(r[0]?.unread ?? 0),
        })),

      // Upcoming appointments (next 5 from now)
      db
        .select({
          id: schema.appointments.id,
          startsAt: schema.appointments.startsAt,
          endsAt: schema.appointments.endsAt,
          status: schema.appointments.status,
          patientName: schema.patients.name,
          patientPhone: schema.patients.phone,
          serviceName: schema.services.name,
          professionalName: schema.professionals.name,
        })
        .from(schema.appointments)
        .leftJoin(schema.patients, eq(schema.appointments.patientId, schema.patients.id))
        .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
        .leftJoin(schema.professionals, eq(schema.appointments.professionalId, schema.professionals.id))
        .where(
          and(
            eq(schema.appointments.clinicId, clinicId),
            gte(schema.appointments.startsAt, now),
            sql`${schema.appointments.status} not in ('cancelled', 'no_show')`,
          ),
        )
        .orderBy(schema.appointments.startsAt)
        .limit(5),

      // Recent conversations (last 5)
      db
        .select({
          id: schema.conversations.id,
          externalId: schema.conversations.externalId,
          status: schema.conversations.status,
          unreadCount: schema.conversations.unreadCount,
          lastMessageAt: schema.conversations.lastMessageAt,
          patientName: schema.patients.name,
        })
        .from(schema.conversations)
        .leftJoin(schema.patients, eq(schema.conversations.patientId, schema.patients.id))
        .where(eq(schema.conversations.clinicId, clinicId))
        .orderBy(desc(schema.conversations.lastMessageAt))
        .limit(5),
    ]);

    return {
      totalPatients,
      appointmentsToday,
      activeConversations: activeConversations.count,
      unreadMessages: activeConversations.unreadCount,
      upcomingAppointments,
      recentConversations,
    };
  }

  async getAppointmentsReport(clinicId: string, from: Date, to: Date) {
    const rows = await db
      .select({
        status: schema.appointments.status,
        count: sql<number>`count(*)`,
        revenueCents: sql<number>`sum(coalesce(${schema.services.priceCents}, 0))`,
      })
      .from(schema.appointments)
      .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(
        and(
          eq(schema.appointments.clinicId, clinicId),
          gte(schema.appointments.startsAt, from),
          lte(schema.appointments.startsAt, to),
        ),
      )
      .groupBy(schema.appointments.status);

    const byStatus: Record<string, { count: number; revenueCents: number }> = {};
    for (const r of rows) {
      byStatus[r.status] = {
        count: Number(r.count),
        revenueCents: Number(r.revenueCents),
      };
    }

    const total = Object.values(byStatus).reduce((n, v) => n + v.count, 0);
    const totalRevenueCents = Object.values(byStatus).reduce((n, v) => n + v.revenueCents, 0);

    return { byStatus, total, totalRevenueCents };
  }

  async getConversationsReport(clinicId: string) {
    const rows = await db
      .select({
        status: schema.conversations.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.conversations)
      .where(eq(schema.conversations.clinicId, clinicId))
      .groupBy(schema.conversations.status);

    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status || 'unknown'] = Number(r.count);

    // Conversations that generated at least one appointment (via patientId)
    const withAppointment = await db
      .select({ conversationId: schema.conversations.id })
      .from(schema.conversations)
      .innerJoin(
        schema.appointments,
        and(
          eq(schema.appointments.patientId, schema.conversations.patientId!),
          eq(schema.appointments.clinicId, clinicId),
        ),
      )
      .where(
        and(
          eq(schema.conversations.clinicId, clinicId),
          sql`${schema.conversations.patientId} is not null`,
        ),
      )
      .groupBy(schema.conversations.id);

    const total = Object.values(byStatus).reduce((n, v) => n + v, 0);
    return { byStatus, total, convertedCount: withAppointment.length };
  }

  async exportAppointmentsCsv(clinicId: string, from: Date, to: Date): Promise<string> {
    const rows = await db
      .select({
        id: schema.appointments.id,
        startsAt: schema.appointments.startsAt,
        endsAt: schema.appointments.endsAt,
        status: schema.appointments.status,
        patientName: schema.patients.name,
        patientPhone: schema.patients.phone,
        serviceName: schema.services.name,
        priceCents: schema.services.priceCents,
        professionalName: schema.professionals.name,
        notes: schema.appointments.notes,
      })
      .from(schema.appointments)
      .leftJoin(schema.patients, eq(schema.appointments.patientId, schema.patients.id))
      .leftJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .leftJoin(schema.professionals, eq(schema.appointments.professionalId, schema.professionals.id))
      .where(
        and(
          eq(schema.appointments.clinicId, clinicId),
          gte(schema.appointments.startsAt, from),
          lte(schema.appointments.startsAt, to),
        ),
      )
      .orderBy(schema.appointments.startsAt);

    const header = 'Data,Hora,Paciente,Telefone,Serviço,Profissional,Valor (R$),Status,Observações';
    const lines = rows.map((r) => {
      const d = new Date(r.startsAt);
      const date = d.toLocaleDateString('pt-BR');
      const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const price = r.priceCents ? (r.priceCents / 100).toFixed(2).replace('.', ',') : '';
      const csv = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
      return [date, time, csv(r.patientName), csv(r.patientPhone), csv(r.serviceName), csv(r.professionalName), price, r.status, csv(r.notes)].join(',');
    });

    return [header, ...lines].join('\n');
  }
}
