import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function buscarPaciente(
  input: { phone: string },
  context: ToolContext,
): Promise<string> {
  // A identidade do paciente é o número de onde a conversa está chegando, que já
  // está no contexto — o modelo não tem como saber isso e, quando tenta, manda
  // lixo ("Kadu", "kadu_phone") ou o número que o paciente digitou, que não bate
  // com o do WhatsApp. Só cai no input se o contexto não tiver telefone.
  const phone = context.patientPhone || input.phone;

  const results = await db
    .select()
    .from(schema.patients)
    .where(
      and(
        eq(schema.patients.clinicId, context.clinicId),
        eq(schema.patients.phone, phone),
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
