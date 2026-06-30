import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { NotFoundError, type PaginationInput } from '@crm-clinicas/shared';

@Injectable()
export class ServicesService {
  async findAll(clinicId: string, pagination: PaginationInput) {
    const { page, pageSize, search } = pagination;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.services.clinicId, clinicId)];
    if (search) {
      conditions.push(ilike(schema.services.name, `%${search}%`));
    }

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(schema.services)
        .where(and(...conditions))
        .orderBy(desc(schema.services.name))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.services)
        .where(and(...conditions)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(clinicId: string, id: string) {
    const result = await db
      .select()
      .from(schema.services)
      .where(and(eq(schema.services.clinicId, clinicId), eq(schema.services.id, id)))
      .limit(1);

    if (!result[0]) throw new NotFoundError('Serviço', id);
    return result[0];
  }

  async create(clinicId: string, data: Omit<schema.NewService, 'clinicId'>) {
    const result = await db.insert(schema.services).values({ ...data, clinicId }).returning();
    return result[0]!;
  }

  async update(clinicId: string, id: string, data: Partial<schema.NewService>) {
    const result = await db
      .update(schema.services)
      .set(data)
      .where(and(eq(schema.services.clinicId, clinicId), eq(schema.services.id, id)))
      .returning();

    if (!result[0]) throw new NotFoundError('Serviço', id);
    return result[0];
  }

  async delete(clinicId: string, id: string) {
    const result = await db
      .delete(schema.services)
      .where(and(eq(schema.services.clinicId, clinicId), eq(schema.services.id, id)))
      .returning();

    if (!result[0]) throw new NotFoundError('Serviço', id);
    return result[0];
  }
}
