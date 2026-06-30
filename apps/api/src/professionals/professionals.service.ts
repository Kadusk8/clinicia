import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NotFoundError, type PaginationInput } from '@crm-clinicas/shared';

@Injectable()
export class ProfessionalsService {
  async findAll(clinicId: string, pagination: PaginationInput) {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(schema.professionals)
        .where(eq(schema.professionals.clinicId, clinicId))
        .orderBy(desc(schema.professionals.name))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.professionals)
        .where(eq(schema.professionals.clinicId, clinicId)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(clinicId: string, id: string) {
    const result = await db
      .select()
      .from(schema.professionals)
      .where(
        and(eq(schema.professionals.clinicId, clinicId), eq(schema.professionals.id, id)),
      )
      .limit(1);

    if (!result[0]) throw new NotFoundError('Profissional', id);
    return result[0];
  }

  async create(clinicId: string, data: Omit<schema.NewProfessional, 'clinicId'>) {
    const result = await db
      .insert(schema.professionals)
      .values({ ...data, clinicId })
      .returning();
    return result[0]!;
  }

  async update(clinicId: string, id: string, data: Partial<schema.NewProfessional>) {
    const result = await db
      .update(schema.professionals)
      .set(data)
      .where(
        and(eq(schema.professionals.clinicId, clinicId), eq(schema.professionals.id, id)),
      )
      .returning();

    if (!result[0]) throw new NotFoundError('Profissional', id);
    return result[0];
  }

  async delete(clinicId: string, id: string) {
    const result = await db
      .delete(schema.professionals)
      .where(
        and(eq(schema.professionals.clinicId, clinicId), eq(schema.professionals.id, id)),
      )
      .returning();

    if (!result[0]) throw new NotFoundError('Profissional', id);
    return result[0];
  }
}
