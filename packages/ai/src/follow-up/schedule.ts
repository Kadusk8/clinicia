import { db, schema } from '@crm-clinicas/db';
import { and, eq, inArray } from 'drizzle-orm';
import { clampToSendWindow } from '@crm-clinicas/shared';

/**
 * Sequência de re-engajamento: quando um paciente para de responder depois
 * de uma resposta do agente, insiste em 7 toques (20min, 2h, 6h, 24h, 48h,
 * 4 dias, 7 dias) até alguém decidir que não vale mais a pena — o gate de
 * decisão (decide.ts) roda em cada toque e pode cancelar o resto a qualquer
 * momento, então "agendar aqui" nunca é "vai mandar 7 mensagens garantido".
 *
 * scheduleReengagementSequence só é chamada pelo messageWorker (fim de um
 * turno do agente) — nunca pelo followUpWorker que processa esses mesmos
 * follow-ups, senão cada envio reagendaria a si mesmo indefinidamente.
 */

// 20min, 2h, 6h, 24h, 48h, 4 dias, 7 dias.
export const REENGAGEMENT_STEPS_MS = [
  20 * 60_000,
  2 * 3_600_000,
  6 * 3_600_000,
  24 * 3_600_000,
  48 * 3_600_000,
  96 * 3_600_000,
  168 * 3_600_000,
];

// Distância mínima entre dois toques consecutivos depois de ajustados pra
// janela comercial. Sem isso, uma conversa que morre às 23h faria os toques
// de 20min/2h/6h caírem todos às 08h do dia seguinte — três mensagens juntas.
export const MIN_STEP_GAP_MS = 90 * 60_000;

export async function scheduleReengagementSequence(args: {
  clinicId: string;
  conversationId: string;
  patientId: string;
  from?: Date;
}): Promise<number> {
  const { clinicId, conversationId, patientId } = args;
  const from = args.from ?? new Date();

  // Cada turno reancora a sequência no agora — cancela qualquer resquício de
  // uma rodada anterior antes de criar a nova (idempotente por conversa).
  await cancelReengagementSequence({ conversationId }, 'rescheduled');

  const [patient] = await db
    .select({ reengagementOptOut: schema.patients.reengagementOptOut })
    .from(schema.patients)
    .where(eq(schema.patients.id, patientId))
    .limit(1);

  if (patient?.reengagementOptOut) return 0;

  let previous: Date | null = null;
  const rows: (typeof schema.followUps.$inferInsert)[] = [];

  for (let i = 0; i < REENGAGEMENT_STEPS_MS.length; i++) {
    const offsetMs = REENGAGEMENT_STEPS_MS[i]!;
    let scheduledFor = clampToSendWindow(new Date(from.getTime() + offsetMs));

    if (previous && scheduledFor.getTime() < previous.getTime() + MIN_STEP_GAP_MS) {
      scheduledFor = clampToSendWindow(new Date(previous.getTime() + MIN_STEP_GAP_MS));
    }

    rows.push({
      clinicId,
      patientId,
      conversationId,
      type: 'reengagement',
      templateKey: `reengagement_${i + 1}`,
      scheduledFor,
      status: 'pending',
      metadata: { stepIndex: i, totalSteps: REENGAGEMENT_STEPS_MS.length, scheduledFromIso: from.toISOString() },
    });

    previous = scheduledFor;
  }

  await db.insert(schema.followUps).values(rows);
  return rows.length;
}

export async function cancelReengagementSequence(
  filter: { conversationId?: string; patientId?: string },
  reason: string,
): Promise<number> {
  if (!filter.conversationId && !filter.patientId) return 0;

  const conditions = [
    eq(schema.followUps.type, 'reengagement'),
    inArray(schema.followUps.status, ['pending', 'queued']),
  ];
  if (filter.conversationId) conditions.push(eq(schema.followUps.conversationId, filter.conversationId));
  if (filter.patientId) conditions.push(eq(schema.followUps.patientId, filter.patientId));

  const result = await db
    .update(schema.followUps)
    .set({ status: 'cancelled', metadata: { reason } })
    .where(and(...conditions))
    .returning({ id: schema.followUps.id });

  return result.length;
}
