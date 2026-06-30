import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function buscarPaciente(
  input: { phone: string },
  context: ToolContext,
): Promise<string> {
  const results = await db
    .select()
    .from(schema.patients)
    .where(
      and(
        eq(schema.patients.clinicId, context.clinicId),
        eq(schema.patients.phone, input.phone),
      ),
    )
    .limit(1);

  if (!results[0]) {
    return JSON.stringify({ found: false, message: 'Paciente não encontrado.' });
  }

  const p = results[0];
  return JSON.stringify({
    found: true,
    patient: {
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      birthDate: p.birthDate,
      insurance: p.insurance,
      lgpdConsent: p.lgpdConsent,
      notes: p.notes,
      tags: p.tags,
    },
  });
}
