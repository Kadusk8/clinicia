import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '@crm-clinicas/shared';
import { updateClinicSchema } from '@crm-clinicas/shared';
import { z } from 'zod';

type UpdateClinicInput = z.infer<typeof updateClinicSchema>;

@Injectable()
export class ClinicsService {
  async findMe(clinicId: string) {
    const [clinic] = await db
      .select({
        id: schema.clinics.id,
        name: schema.clinics.name,
        slug: schema.clinics.slug,
        type: schema.clinics.type,
        timezone: schema.clinics.timezone,
        phone: schema.clinics.phone,
        email: schema.clinics.email,
        address: schema.clinics.address,
        whatsappConnected: schema.clinics.whatsappConnected,
        plan: schema.clinics.plan,
        active: schema.clinics.active,
        trialEndsAt: schema.clinics.trialEndsAt,
        createdAt: schema.clinics.createdAt,
      })
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinicId))
      .limit(1);

    if (!clinic) throw new NotFoundError('Clínica', clinicId);
    return clinic;
  }

  async update(clinicId: string, data: UpdateClinicInput) {
    // Only allow updating non-sensitive fields
    const allowed: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) allowed.name = data.name;
    if (data.phone !== undefined) allowed.phone = data.phone;
    if (data.email !== undefined) allowed.email = data.email;
    if (data.address !== undefined) allowed.address = data.address;
    if (data.timezone !== undefined) allowed.timezone = data.timezone;

    const [updated] = await db
      .update(schema.clinics)
      .set(allowed)
      .where(eq(schema.clinics.id, clinicId))
      .returning({
        id: schema.clinics.id,
        name: schema.clinics.name,
        slug: schema.clinics.slug,
        type: schema.clinics.type,
        timezone: schema.clinics.timezone,
        phone: schema.clinics.phone,
        email: schema.clinics.email,
        address: schema.clinics.address,
        whatsappConnected: schema.clinics.whatsappConnected,
        plan: schema.clinics.plan,
        active: schema.clinics.active,
        trialEndsAt: schema.clinics.trialEndsAt,
        createdAt: schema.clinics.createdAt,
      });

    if (!updated) throw new NotFoundError('Clínica', clinicId);
    return updated;
  }
}
