import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NotFoundError, type PaginationInput } from '@crm-clinicas/shared';

@Injectable()
export class PipelineService {
  async findAll(clinicId: string, pagination: PaginationInput) {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(schema.deals)
        .where(eq(schema.deals.clinicId, clinicId))
        .orderBy(desc(schema.deals.updatedAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.deals)
        .where(eq(schema.deals.clinicId, clinicId)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByStage(clinicId: string) {
    // Returns deals grouped by stage for Kanban view (with patient + service names)
    const data = await db
      .select({
        id: schema.deals.id,
        stage: schema.deals.stage,
        valueCents: schema.deals.valueCents,
        notes: schema.deals.notes,
        lostReason: schema.deals.lostReason,
        createdAt: schema.deals.createdAt,
        updatedAt: schema.deals.updatedAt,
        patientId: schema.deals.patientId,
        serviceId: schema.deals.serviceId,
        patientName: schema.patients.name,
        patientPhone: schema.patients.phone,
        serviceName: schema.services.name,
      })
      .from(schema.deals)
      .leftJoin(schema.patients, eq(schema.deals.patientId, schema.patients.id))
      .leftJoin(schema.services, eq(schema.deals.serviceId, schema.services.id))
      .where(eq(schema.deals.clinicId, clinicId))
      .orderBy(desc(schema.deals.updatedAt));

    const grouped: Record<string, typeof data> = {};
    for (const deal of data) {
      if (!grouped[deal.stage]) grouped[deal.stage] = [];
      grouped[deal.stage]!.push(deal);
    }
    return grouped;
  }

  async create(clinicId: string, data: Omit<schema.NewDeal, 'clinicId'>) {
    const result = await db.insert(schema.deals).values({ ...data, clinicId }).returning();
    return result[0]!;
  }

  async updateStage(clinicId: string, id: string, stage: string) {
    const result = await db
      .update(schema.deals)
      .set({ stage, updatedAt: new Date() })
      .where(and(eq(schema.deals.clinicId, clinicId), eq(schema.deals.id, id)))
      .returning();

    if (!result[0]) throw new NotFoundError('Deal', id);
    return result[0];
  }

  async update(clinicId: string, id: string, data: Partial<schema.NewDeal>) {
    const result = await db
      .update(schema.deals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.deals.clinicId, clinicId), eq(schema.deals.id, id)))
      .returning();

    if (!result[0]) throw new NotFoundError('Deal', id);
    return result[0];
  }
}
