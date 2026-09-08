import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { NotFoundError, TenantMismatchError, type PaginationInput } from '@crm-clinicas/shared';

type CreateInput = Omit<schema.NewProfessional, 'clinicId'> & { serviceIds?: string[] };
type UpdateInput = Partial<Omit<schema.NewProfessional, 'clinicId'>> & { serviceIds?: string[] };

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
    return {
      data: await this.attachServiceIds(data),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
    const [withServices] = await this.attachServiceIds(result);
    return withServices;
  }

  // Junta os serviços vinculados (professional_services) em cada profissional —
  // a tela precisa disso pra mostrar/editar quais serviços ele atende.
  private async attachServiceIds<T extends { id: string }>(
    rows: T[],
  ): Promise<(T & { serviceIds: string[] })[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const links = await db
      .select()
      .from(schema.professionalServices)
      .where(inArray(schema.professionalServices.professionalId, ids));

    const byProfessional = new Map<string, string[]>();
    for (const link of links) {
      const arr = byProfessional.get(link.professionalId) ?? [];
      arr.push(link.serviceId);
      byProfessional.set(link.professionalId, arr);
    }

    return rows.map((r) => ({ ...r, serviceIds: byProfessional.get(r.id) ?? [] }));
  }

  // undefined = não mexe nos vínculos (ex: PATCH de working-hours, que não envia serviceIds).
  // [] explícito = desvincula de tudo. Valida que todo serviceId pertence à mesma clínica
  // antes de gravar — sem isso, um profissional de uma clínica poderia ser vinculado ao
  // serviço de outra clínica (IDOR entre tenants).
  private async syncServiceLinks(
    clinicId: string,
    professionalId: string,
    serviceIds: string[] | undefined,
  ) {
    if (serviceIds === undefined) return;

    if (serviceIds.length > 0) {
      const valid = await db
        .select({ id: schema.services.id })
        .from(schema.services)
        .where(and(inArray(schema.services.id, serviceIds), eq(schema.services.clinicId, clinicId)));

      if (valid.length !== new Set(serviceIds).size) {
        throw new TenantMismatchError();
      }
    }

    await db
      .delete(schema.professionalServices)
      .where(eq(schema.professionalServices.professionalId, professionalId));
    if (serviceIds.length > 0) {
      await db
        .insert(schema.professionalServices)
        .values(serviceIds.map((serviceId) => ({ professionalId, serviceId })));
    }
  }

  async create(clinicId: string, data: CreateInput) {
    const { serviceIds, ...rest } = data;
    const result = await db
      .insert(schema.professionals)
      .values({ ...rest, clinicId })
      .returning();
    const professional = result[0]!;
    await this.syncServiceLinks(clinicId, professional.id, serviceIds);
    const [withServices] = await this.attachServiceIds([professional]);
    return withServices;
  }

  async update(clinicId: string, id: string, data: UpdateInput) {
    const { serviceIds, ...rest } = data;

    let updated: schema.Professional | undefined;
    if (Object.keys(rest).length > 0) {
      const result = await db
        .update(schema.professionals)
        .set(rest)
        .where(
          and(eq(schema.professionals.clinicId, clinicId), eq(schema.professionals.id, id)),
        )
        .returning();
      updated = result[0];
    } else {
      const result = await db
        .select()
        .from(schema.professionals)
        .where(
          and(eq(schema.professionals.clinicId, clinicId), eq(schema.professionals.id, id)),
        )
        .limit(1);
      updated = result[0];
    }

    if (!updated) throw new NotFoundError('Profissional', id);
    await this.syncServiceLinks(clinicId, id, serviceIds);
    const [withServices] = await this.attachServiceIds([updated]);
    return withServices;
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
