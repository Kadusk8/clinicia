import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';
import { cancelReengagementSequence } from '../../follow-up/schedule.js';

export async function transferirHumano(
  input: { motivo: string; urgencia: 'baixa' | 'media' | 'alta' },
  context: ToolContext,
): Promise<string> {
  await db
    .update(schema.conversations)
    .set({ status: 'human_active', updatedAt: new Date() })
    .where(eq(schema.conversations.id, context.conversationId));

  // Um humano assumiu — o automático não pode continuar mandando follow-up
  // por cima do atendimento manual.
  await cancelReengagementSequence({ conversationId: context.conversationId }, 'transferred_to_human');

  await db.insert(schema.messages).values({
    conversationId: context.conversationId,
    clinicId: context.clinicId,
    role: 'system',
    content: `[Transferência para humano] Motivo: ${input.motivo} | Urgência: ${input.urgencia}`,
  });

  return JSON.stringify({
    success: true,
    message: 'Conversa transferida para atendimento humano.',
    urgencia: input.urgencia,
  });
}
