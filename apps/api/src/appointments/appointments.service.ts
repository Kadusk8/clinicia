import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { NotFoundError, type PaginationInput } from '@crm-clinicas/shared';
import { FollowUpsService } from '../follow-ups/follow-ups.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(forwardRef(() => FollowUpsService))
    private readonly followUpsService: FollowUpsService,
  ) {}

  async findAll(clinicId: string, pagination: PaginationInput) {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.clinicId, clinicId))
        .orderBy(desc(schema.appointments.startsAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.appointments)
        .where(eq(schema.appointments.clinicId, clinicId)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByDateRange(clinicId: string, from: Date, to: Date) {
    return db
      .select({
        id: schema.appointments.id,
        startsAt: schema.appointments.startsAt,
        endsAt: schema.appointments.endsAt,
        status: schema.appointments.status,
        notes: schema.appointments.notes,
        source: schema.appointments.source,
        patientId: schema.appointments.patientId,
        professionalId: schema.appointments.professionalId,
        serviceId: schema.appointments.serviceId,
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
          gte(schema.appointments.startsAt, from),
          lte(schema.appointments.startsAt, to),
        ),
      )
      .orderBy(schema.appointments.startsAt);
  }

  async findById(clinicId: string, id: string) {
    const result = await db
      .select()
      .from(schema.appointments)
      .where(
        and(eq(schema.appointments.clinicId, clinicId), eq(schema.appointments.id, id)),
      )
      .limit(1);

    if (!result[0]) throw new NotFoundError('Agendamento', id);
    return result[0];
  }

  async create(clinicId: string, data: Omit<schema.NewAppointment, 'clinicId'>) {
    const service = await db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, data.serviceId))
      .limit(1);

    const durationMin = service[0]?.durationMin ?? 30;
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

    const result = await db
      .insert(schema.appointments)
      .values({ ...data, clinicId, endsAt })
      .returning();

    const appointment = result[0]!;

    // Auto-create follow-ups (reminder_24h, reminder_2h, post_visit)
    await this.followUpsService.createForAppointment(
      clinicId,
      appointment.id,
      data.patientId,
      startsAt,
    );

    return appointment;
  }

  async update(clinicId: string, id: string, data: Partial<schema.NewAppointment>) {
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

    if (data.status === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    const result = await db
      .update(schema.appointments)
      .set(updateData)
      .where(
        and(eq(schema.appointments.clinicId, clinicId), eq(schema.appointments.id, id)),
      )
      .returning();

    if (!result[0]) throw new NotFoundError('Agendamento', id);

    // Cancel pending follow-ups if appointment is cancelled
    if (data.status === 'cancelled') {
      await this.followUpsService.cancelForAppointment(id);
    }

    return result[0];
  }

  async cancel(clinicId: string, id: string, reason?: string) {
    return this.update(clinicId, id, {
      status: 'cancelled',
      cancellationReason: reason,
    } as Partial<schema.NewAppointment>);
  }
}
