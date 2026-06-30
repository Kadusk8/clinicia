import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function registrarAnotacaoCrm(
  input: { patientId: string; note: string; tags?: string[] },
  context: ToolContext,
): Promise<string> {
  const existing = await db
    .select({ notes: schema.patients.notes, tags: schema.patients.tags })
    .from(schema.patients)
    .where(
      and(
        eq(schema.patients.id, input.patientId),
        eq(schema.patients.clinicId, context.clinicId),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return JSON.stringify({ success: false, error: 'Paciente não encontrado.' });
  }

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const newNote = `[${timestamp}] ${input.note}`;
  const updatedNotes = existing[0].notes ? `${existing[0].notes}\n${newNote}` : newNote;

  const currentTags = existing[0].tags ?? [];
  const newTags = input.tags ?? [];
  const mergedTags = Array.from(new Set([...currentTags, ...newTags]));

  await db
    .update(schema.patients)
    .set({ notes: updatedNotes, tags: mergedTags, updatedAt: new Date() })
    .where(
      and(
        eq(schema.patients.id, input.patientId),
        eq(schema.patients.clinicId, context.clinicId),
      ),
    );

  return JSON.stringify({ success: true, message: 'Anotação registrada com sucesso.' });
}
