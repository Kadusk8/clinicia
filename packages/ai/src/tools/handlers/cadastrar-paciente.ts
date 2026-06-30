import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function cadastrarPaciente(
  input: { phone: string; name: string; birthDate?: string; email?: string; insurance?: string },
  context: ToolContext,
): Promise<string> {
  // Check if patient already exists
  const existing = await db
    .select()
    .from(schema.patients)
    .where(
      and(
        eq(schema.patients.clinicId, context.clinicId),
        eq(schema.patients.phone, input.phone),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return JSON.stringify({
      created: false,
      message: 'Paciente já cadastrado.',
      patient: { id: existing[0].id, name: existing[0].name, phone: existing[0].phone },
    });
  }

  const rows = await db
    .insert(schema.patients)
    .values({
      clinicId: context.clinicId,
      phone: input.phone,
      name: input.name,
      birthDate: input.birthDate,
      email: input.email,
      insurance: input.insurance,
      lgpdConsent: true,
      lgpdConsentAt: new Date(),
    })
    .returning();

  const inserted = rows[0];
  if (!inserted) {
    return JSON.stringify({ created: false, error: 'Falha ao cadastrar paciente.' });
  }

  return JSON.stringify({
    created: true,
    patient: { id: inserted.id, name: inserted.name, phone: inserted.phone },
  });
}
