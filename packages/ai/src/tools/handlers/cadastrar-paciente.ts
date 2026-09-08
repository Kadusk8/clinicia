import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';
import { ensureLeadDeal } from '../pipeline.js';

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
    // O webhook cria o paciente só com o telefone assim que a conversa começa,
    // então "já cadastrado" quase sempre é um registro sem nome. Completa os
    // campos que estiverem vazios em vez de descartar o que o paciente informou.
    const fill: Partial<typeof schema.patients.$inferInsert> = {};
    if (!existing[0].name && input.name) fill.name = input.name;
    if (!existing[0].birthDate && input.birthDate) fill.birthDate = input.birthDate;
    if (!existing[0].email && input.email) fill.email = input.email;
    if (!existing[0].insurance && input.insurance) fill.insurance = input.insurance;

    let patient = existing[0];
    if (Object.keys(fill).length > 0) {
      const [updated] = await db
        .update(schema.patients)
        .set({ ...fill, lgpdConsent: true, lgpdConsentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.patients.id, existing[0].id))
        .returning();
      if (updated) patient = updated;
    }

    await ensureLeadDeal(context.clinicId, patient.id);

    return JSON.stringify({
      created: false,
      message: 'Paciente já cadastrado — dados atualizados.',
      patient: { id: patient.id, name: patient.name, phone: patient.phone },
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

  await ensureLeadDeal(context.clinicId, inserted.id);

  return JSON.stringify({
    created: true,
    patient: { id: inserted.id, name: inserted.name, phone: inserted.phone },
  });
}
