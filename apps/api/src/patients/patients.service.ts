import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { NotFoundError, type PaginationInput } from '@crm-clinicas/shared';

@Injectable()
export class PatientsService {
  async findAll(clinicId: string, pagination: PaginationInput) {
    const { page, pageSize, search } = pagination;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.patients.clinicId, clinicId)];
    if (search) {
      conditions.push(
        or(
          ilike(schema.patients.name, `%${search}%`),
          ilike(schema.patients.phone, `%${search}%`),
          ilike(schema.patients.email, `%${search}%`),
        )!,
      );
    }

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(schema.patients)
        .where(and(...conditions))
        .orderBy(desc(schema.patients.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.patients)
        .where(and(...conditions)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(clinicId: string, id: string) {
    const result = await db
      .select()
      .from(schema.patients)
      .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.id, id)))
      .limit(1);

    if (!result[0]) {
      throw new NotFoundError('Paciente', id);
    }
    return result[0];
  }

  async findByPhone(clinicId: string, phone: string) {
    const result = await db
      .select()
      .from(schema.patients)
      .where(
        and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.phone, phone)),
      )
      .limit(1);
    return result[0] || null;
  }

  async create(clinicId: string, data: Omit<schema.NewPatient, 'clinicId'>) {
    const result = await db
      .insert(schema.patients)
      .values({ ...data, clinicId })
      .returning();
    return result[0]!;
  }

  async update(clinicId: string, id: string, data: Partial<schema.NewPatient>) {
    const result = await db
      .update(schema.patients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.id, id)))
      .returning();

    if (!result[0]) {
      throw new NotFoundError('Paciente', id);
    }
    return result[0];
  }

  async delete(clinicId: string, id: string) {
    const result = await db
      .delete(schema.patients)
      .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.id, id)))
      .returning();

    if (!result[0]) {
      throw new NotFoundError('Paciente', id);
    }
    return result[0];
  }
}
