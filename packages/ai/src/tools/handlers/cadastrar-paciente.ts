import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function cadastrarPaciente(
  input: { phone: string; name: string; birthDate?: string; email?: string; insurance?: string },
  context: ToolContext,
): Promise<string> {
  // Mesmo motivo do buscar_paciente: o telefone do cadastro tem que ser o número
  // do WhatsApp da conversa, não o que o modelo inferiu ou o paciente digitou —
  // senão o cadastro nasce com um telefone que nenhuma busca futura encontra.
  const phone = context.patientPhone || input.phone;

  // Check if patient already exists
  const existing = await db
    .select()
    .from(schema.patients)
    .where(
      and(
        eq(schema.patients.clinicId, context.clinicId),
        eq(schema.patients.phone, phone),
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
      phone,
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
