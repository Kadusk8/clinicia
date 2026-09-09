import { Worker, Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, inArray, lte, gt, desc, sql } from 'drizzle-orm';
import { EvolutionClient, sendHumanizedText } from '@crm-clinicas/evolution';
import {
  createAgent,
  executeToolCall,
  generateEmbedding,
  chunkText,
  buildMessageWindow,
  shouldRegenerateSummary,
  buildSummaryPrompt,
  classifyCategory,
  scheduleReengagementSequence,
  cancelReengagementSequence,
  decideReengagement,
  REENGAGEMENT_STEPS_MS,
  MIN_STEP_GAP_MS,
  type AgentMessage,
} from '@crm-clinicas/ai';
import type { AgentConfig } from '@crm-clinicas/shared';
import { isWithinSendWindow, clampToSendWindow, brasiliaLabel } from '@crm-clinicas/shared';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// ==========================================
// Follow-up message templates
// ==========================================

const TEMPLATES: Record<string, (name: string, clinic: string, date: string, service: string) => string> = {
  reminder_24h: (p, c, d, s) =>
    `Olá ${p}! 😊 Lembrando que amanhã você tem uma consulta de *${s}* na *${c}* às *${d}*. Confirma presença? Responda SIM ou NÃO.`,
  reminder_2h: (p, c, d, s) =>
    `Oi ${p}! Sua consulta de *${s}* na *${c}* é daqui a *2 horas* (${d}). Estamos te esperando! 🏥`,
  post_visit: (p, c) =>
    `Olá ${p}! 😊 Como foi sua experiência na *${c}*? De 0 a 10, que nota você daria para o nosso atendimento? ⭐`,
  reactivation_30d: (p, c) =>
    `Oi ${p}! Faz um tempo que não nos vemos. A *${c}* gostaria de te receber novamente. Quer agendar? Responda SIM!`,
};

// ==========================================
// Reidratação de tool results no histórico
// ==========================================

const MAX_TOOL_RESULT_CHARS = 900;

type PersistedToolCall = { name: string; input: Record<string, unknown>; result: string };

/**
 * Recoloca no texto da mensagem do agente os resultados das tools daquele turno.
 * A conversa é reconstruída do banco a cada mensagem nova, e a coluna tool_calls
 * ficava de fora — então tudo que uma tool devolveu (UUIDs de paciente, serviço e
 * profissional, horários disponíveis) sumia do contexto no turno seguinte, e o
 * modelo acabava chutando esses valores na hora de agendar.
 */
function withToolResults(content: string, toolCalls: unknown): string {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return content;

  const lines = (toolCalls as PersistedToolCall[])
    .filter((c) => c && typeof c.name === 'string')
    .map((c) => {
      const result = typeof c.result === 'string' ? c.result : JSON.stringify(c.result);
      const trimmed = result.length > MAX_TOOL_RESULT_CHARS
        ? `${result.slice(0, MAX_TOOL_RESULT_CHARS)}…(truncado)`
        : result;
      return `- ${c.name}(${JSON.stringify(c.input)}) → ${trimmed}`;
    });

  if (lines.length === 0) return content;

  return `${content}\n\n[Ferramentas que você já executou neste atendimento e o que elas retornaram. ` +
    `Reutilize estes IDs exatos — não invente nem reescreva nenhum:\n${lines.join('\n')}]`;
}

// ==========================================
// Queues
// ==========================================

export const messageQueue = new Queue('process_message', { connection });
export const followUpQueue = new Queue('follow_up', { connection });
export const embeddingQueue = new Queue('embedding', { connection });

// ==========================================
// Workers
// ==========================================

// Process AI message worker — FULLY IMPLEMENTED
const messageWorker = new Worker(
  'process_message',
  async (job) => {
    const { conversationId, clinicId, triggeredCategoryKey } = job.data as {
      conversationId: string;
      clinicId: string;
      triggeredCategoryKey?: string | null;
    };
    console.log(`🤖 Processing message for conversation: ${conversationId}`);

    // 1. Fetch conversation and clinic
    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      console.error(`Conversation ${conversationId} not found`);
      return;
    }

    // Guard: if conversation was taken over by human between enqueue and processing, skip
    if (conversation.status !== 'agent_active') {
      console.log(`Conversation ${conversationId} is ${conversation.status}, skipping AI`);
      return;
    }

    const [clinic] = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinicId))
      .limit(1);

    if (!clinic || !clinic.active) {
      console.log(`Clinic ${clinicId} not found or suspended`);
      return;
    }

    if (!clinic.whatsappInstanceName) {
      console.error(`Clinic ${clinicId} has no WhatsApp instance`);
      return;
    }

    // 2. Fetch all messages to count total turns, and get the last 20 for context
    const allMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt));

    const totalTurns = allMessages.length;
    const rawMessages = allMessages.slice(0, 20).reverse();

    // 3. Map roles for the agent
    // Os resultados das tools precisam voltar pro contexto junto com o texto da
    // resposta: cada mensagem nova do paciente é uma invocação nova do agente, e
    // sem isso o modelo perde todo o retorno de tool do turno anterior — inclusive
    // os UUIDs de paciente/serviço/profissional. Era essa a causa dele "inventar"
    // ids (ex: "dr-marcel", "kadu_patient_id"): o valor certo simplesmente não
    // estava mais no contexto na hora de agendar.
    const recentMessages = rawMessages
      .filter((m) => m.role === 'patient' || m.role === 'agent')
      .map((m) => ({
        role: m.role === 'agent' ? ('assistant' as const) : ('user' as const),
        content: m.role === 'agent' ? withToolResults(m.content, m.toolCalls) : m.content,
      }));

    // 4. Build AgentContext and Memory Window
    const agentConfig = (clinic.agentConfig ?? {}) as AgentConfig;
    const clinicName = clinic.name;
    const patientPhone = conversation.externalId ?? '';

    const memoryWindow = buildMessageWindow({
      summary: conversation.summary,
      recentMessages,
      totalTurns,
    });

    const providerKeys = {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      googleApiKey: process.env.GOOGLE_AI_API_KEY,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
    };

    let systemPromptText = clinic.agentSystemPrompt;
    let knowledgeBaseText = clinic.agentKnowledgeBase;
    let resolvedCategoryKey: string | null = null;

    if (clinic.agentMode === 'multi') {
      const activeCategories = await db
        .select()
        .from(schema.agentCategories)
        .where(and(eq(schema.agentCategories.clinicId, clinicId), eq(schema.agentCategories.active, true)));

      let categoryKey: string | null = triggeredCategoryKey ?? null;

      // Sem trigger de categoria explícita nesta mensagem: classifica (permite
      // reclassificar a qualquer momento se o paciente mudar de assunto).
      if (!categoryKey) {
        categoryKey = await classifyCategory(
          activeCategories.map((c): { key: string; label: string } => ({ key: c.key, label: c.label })),
          recentMessages,
          agentConfig,
          providerKeys,
        );
      }

      const resolvedCategory = categoryKey
        ? activeCategories.find((c) => c.key === categoryKey)
        : undefined;

      if (resolvedCategory) {
        systemPromptText = resolvedCategory.systemPrompt;
        knowledgeBaseText = resolvedCategory.knowledgeBase;
        resolvedCategoryKey = resolvedCategory.key;
        if (conversation.categoryKey !== resolvedCategory.key) {
          await db
            .update(schema.conversations)
            .set({ categoryKey: resolvedCategory.key, updatedAt: new Date() })
            .where(eq(schema.conversations.id, conversationId));
        }
      } else {
        // Não classificou com confiança e não há categoria já resolvida:
        // segue sem contexto de categoria — o prompt principal pede esclarecimento.
        systemPromptText = null;
        knowledgeBaseText = null;
      }
    }

    const dynamicContextParts: string[] = [];
    if (systemPromptText) {
      dynamicContextParts.push(`## Instruções específicas da clínica\n${systemPromptText}`);
    }
    if (knowledgeBaseText) {
      dynamicContextParts.push(`## Base de conhecimento\n${knowledgeBaseText}`);
    }

    const context = {
      clinicId,
      conversationId,
      patientPhone,
      clinicConfig: agentConfig,
      clinicName,
      dynamicContext: dynamicContextParts.join('\n\n'),
    };

    // 5. Run agent
    const agent = createAgent(providerKeys);

    // Run summary generation in background if needed (non-blocking for response)
    if (shouldRegenerateSummary({ summary: conversation.summary, recentMessages, totalTurns })) {
      const summaryPrompt = buildSummaryPrompt(memoryWindow);
      // Generate summary and update db (we do this asynchronously so we don't delay the reply)
      agent.processConversation(
        { ...context, dynamicContext: '' },
        [{ role: 'user', content: summaryPrompt }],
        async () => 'ok'
      ).then(async (summaryResult) => {
        if (summaryResult.response) {
          await db
            .update(schema.conversations)
            .set({ summary: summaryResult.response, updatedAt: new Date() })
            .where(eq(schema.conversations.id, conversationId));
          console.log(`📝 Generated new summary for conversation ${conversationId}`);
        }
      }).catch(e => console.error('Summary generation failed:', e));
    }

    const result = await agent.processConversation(context, memoryWindow, (name, input, ctx) =>
      executeToolCall(name, input, {
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        patientPhone: ctx.patientPhone,
        clinicConfig: ctx.clinicConfig,
        categoryKey: resolvedCategoryKey,
      }),
    );

    // 6. If no response text (e.g. only transferir_humano was called), don't send
    if (!result.response) {
      console.log(`No text response for conversation ${conversationId} (tool-only turn)`);
      await persistAgentMessage(conversationId, '', result.toolCalls);
      return;
    }

    // 7. Persist agent message
    await persistAgentMessage(conversationId, result.response, result.toolCalls);

    // 8. Send via Evolution Go using clinic-specific credentials
    if (!clinic.evolutionApiUrl || !clinic.evolutionApiKey) {
      console.error(`Clinic ${clinicId} has no Evolution Go credentials configured`);
      return;
    }
    const clinicEvolutionClient = new EvolutionClient(clinic.evolutionApiUrl, clinic.evolutionApiKey);
    const phone = patientPhone.replace(/\D/g, '');
    const bubbleCount = await sendHumanizedText(clinicEvolutionClient, { number: phone, text: result.response });

    // enviar_localizacao não é texto — é um pin de mapa nativo do WhatsApp.
    // A tool só resolve/valida o local; o envio de verdade acontece aqui,
    // depois dos balões de texto, igual uma pessoa mandaria "olha o mapa"
    // e só depois soltaria o pin.
    for (const call of result.toolCalls) {
      if (call.name !== 'enviar_localizacao') continue;
      let parsed: { success?: boolean; location?: { label: string; address: string; lat: number; lng: number } };
      try {
        parsed = JSON.parse(call.result);
      } catch {
        continue;
      }
      if (!parsed.success || !parsed.location) continue;
      try {
        await clinicEvolutionClient.sendLocation({
          number: phone,
          latitude: parsed.location.lat,
          longitude: parsed.location.lng,
          name: parsed.location.label,
          address: parsed.location.address,
        });
      } catch (e) {
        console.error('Falha ao enviar localização:', (e as Error).message);
      }
    }
    console.log(`✅ Agent reply sent to ${phone} in ${bubbleCount} message(s) (conversation: ${conversationId})`);

    // 9. Agenda a sequência de re-engajamento (20min...7d) — nunca deixa uma
    // falha aqui derrubar a resposta que já foi enviada.
    try {
      const transferredToHuman = result.toolCalls.some((c) => c.name === 'transferir_humano');
      if (!transferredToHuman) {
        const [freshConversation] = await db
          .select({ status: schema.conversations.status, patientId: schema.conversations.patientId })
          .from(schema.conversations)
          .where(eq(schema.conversations.id, conversationId))
          .limit(1);

        const [newestMessage] = await db
          .select({ id: schema.messages.id, role: schema.messages.role })
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, conversationId))
          .orderBy(desc(schema.messages.createdAt))
          .limit(1);

        const [futureAppointment] = await db
          .select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(
            and(
              eq(schema.appointments.patientId, freshConversation?.patientId ?? ''),
              inArray(schema.appointments.status, ['scheduled', 'confirmed']),
              gt(schema.appointments.startsAt, new Date()),
            ),
          )
          .limit(1);

        const [patientRow] = await db
          .select({ reengagementOptOut: schema.patients.reengagementOptOut })
          .from(schema.patients)
          .where(eq(schema.patients.id, freshConversation?.patientId ?? ''))
          .limit(1);

        const stillEligible =
          freshConversation?.status === 'agent_active' &&
          newestMessage?.role === 'agent' &&
          !futureAppointment &&
          !patientRow?.reengagementOptOut;

        if (stillEligible && freshConversation?.patientId) {
          const count = await scheduleReengagementSequence({
            clinicId,
            conversationId,
            patientId: freshConversation.patientId,
          });
          console.log(`⏰ Sequência de re-engajamento agendada (${count} toques) para conversa ${conversationId}`);
        }
      }
    } catch (e) {
      console.error(`Falha ao agendar re-engajamento pra conversa ${conversationId} (ignorada):`, (e as Error).message);
    }
  },
  { connection, concurrency: 5, limiter: { max: 10, duration: 1000 } },
);

async function persistAgentMessage(
  conversationId: string,
  content: string,
  toolCalls: Array<{ name: string; input: Record<string, unknown>; result: string }>,
) {
  const conv = await db
    .select({ clinicId: schema.conversations.clinicId })
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1);

  await db.insert(schema.messages).values({
    conversationId,
    clinicId: conv[0]!.clinicId,
    role: 'agent',
    content: content || '[resposta vazia]',
    toolCalls: toolCalls.length > 0 ? toolCalls : null,
  });
  await db
    .update(schema.conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.conversations.id, conversationId));
}

// Marca failed só na última tentativa — senão um retry bem-sucedido depois
// não desfaz o "failed" que já tinha sido gravado no meio das tentativas.
function isLastAttempt(job: Job): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade + 1 >= maxAttempts;
}

type FollowUpRow = typeof schema.followUps.$inferSelect;
type PatientRow = typeof schema.patients.$inferSelect;
type ClinicRow = typeof schema.clinics.$inferSelect;

// Follow-up de consulta (lembrete 24h/2h, pós-visita) — comportamento
// original, preservado quase intacto.
async function processTemplateFollowUp(
  followUp: FollowUpRow,
  patient: PatientRow,
  clinic: ClinicRow,
  job: Job,
): Promise<void> {
  // 1. Check if clinic is active and has WhatsApp
  if (!clinic.active) {
    console.log(`Clinic ${clinic.name} is suspended, skipping`);
    await db.update(schema.followUps).set({ status: 'cancelled', metadata: { skipReason: 'clinic_suspended' } }).where(eq(schema.followUps.id, followUp.id));
    return;
  }

  if (!clinic.whatsappInstanceName) {
    console.log(`Clinic ${clinic.name} has no WhatsApp instance, skipping`);
    await db.update(schema.followUps).set({ status: 'cancelled', metadata: { skipReason: 'no_whatsapp_instance' } }).where(eq(schema.followUps.id, followUp.id));
    return;
  }

  // 2. Get appointment details if exists
  let appointmentDate = '';
  let serviceName = 'consulta';
  if (followUp.appointmentId) {
    const apt = await db.select().from(schema.appointments).where(eq(schema.appointments.id, followUp.appointmentId)).limit(1);
    if (apt[0]) {
      appointmentDate = new Date(apt[0].startsAt).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      if (apt[0].serviceId) {
        const svc = await db.select().from(schema.services).where(eq(schema.services.id, apt[0].serviceId)).limit(1);
        if (svc[0]) serviceName = svc[0].name;
      }
    }
  }

  // 3. Generate message
  const templateKey = followUp.templateKey || followUp.type;
  const template = TEMPLATES[templateKey];
  const patientName = patient.name ?? 'paciente';
  const message = template
    ? template(patientName, clinic.name, appointmentDate, serviceName)
    : `Olá ${patientName}! A ${clinic.name} tem uma mensagem para você.`;

  // 4. Send via Evolution Go using clinic-specific credentials
  if (!clinic.evolutionApiUrl || !clinic.evolutionApiKey) {
    console.log(`Clinic ${clinic.name} has no Evolution Go credentials, skipping`);
    await db.update(schema.followUps).set({ status: 'cancelled', metadata: { skipReason: 'no_evolution_credentials' } }).where(eq(schema.followUps.id, followUp.id));
    return;
  }
  const clinicEvolutionClient = new EvolutionClient(clinic.evolutionApiUrl, clinic.evolutionApiKey);
  try {
    const phone = patient.phone.replace(/\D/g, '');
    await clinicEvolutionClient.sendText({ number: phone, text: message });
    console.log(`✅ Follow-up sent to ${patient.name} (${phone})`);

    // 5. Mark as sent
    await db.update(schema.followUps).set({ status: 'sent', sentAt: new Date() }).where(eq(schema.followUps.id, followUp.id));

    // 6. Log the message in conversation (if exists)
    const conversation = await db.select().from(schema.conversations)
      .where(and(eq(schema.conversations.clinicId, clinic.id), eq(schema.conversations.externalId, phone)))
      .limit(1);

    if (conversation[0]) {
      await db.insert(schema.messages).values({
        conversationId: conversation[0].id,
        clinicId: clinic.id,
        role: 'agent',
        content: message,
      });
    }
  } catch (err: any) {
    console.error(`❌ Failed to send follow-up to ${patient.name}:`, err.message);
    if (isLastAttempt(job)) {
      await db.update(schema.followUps).set({ status: 'failed' }).where(eq(schema.followUps.id, followUp.id));
    }
    throw err; // BullMQ will retry
  }
}

// Follow-up de re-engajamento: prechecks determinísticos e baratos primeiro
// (cada um é uma query indexada), portão de decisão da IA por último (custa
// dinheiro e um erro nele não pode virar spam pro paciente).
async function processReengagement(
  followUp: FollowUpRow,
  patient: PatientRow,
  clinic: ClinicRow,
  job: Job,
): Promise<void> {
  const conversationId = followUp.conversationId;
  if (!conversationId) {
    await db.update(schema.followUps).set({ status: 'cancelled', metadata: { skipReason: 'no_conversation' } }).where(eq(schema.followUps.id, followUp.id));
    return;
  }

  const [conversation] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1);

  if (!conversation || conversation.status !== 'agent_active') {
    await cancelReengagementSequence({ conversationId }, 'conversation_not_agent_active');
    return;
  }

  if (patient.reengagementOptOut) {
    await cancelReengagementSequence({ conversationId }, 'patient_opted_out');
    return;
  }

  const [newestMessage] = await db
    .select({ role: schema.messages.role })
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(1);

  if (newestMessage && newestMessage.role !== 'agent') {
    // Cinto e suspensório: o cancelamento no webhook já deveria ter pego
    // isso, mas a conversa pode ter sido respondida por outro canal.
    await cancelReengagementSequence({ conversationId }, 'patient_already_replied');
    return;
  }

  const [futureAppointment] = await db
    .select({ id: schema.appointments.id })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.patientId, patient.id),
        inArray(schema.appointments.status, ['scheduled', 'confirmed']),
        gt(schema.appointments.startsAt, new Date()),
      ),
    )
    .limit(1);

  if (futureAppointment) {
    await cancelReengagementSequence({ conversationId }, 'appointment_scheduled');
    return;
  }

  const [latestDeal] = await db
    .select({ stage: schema.deals.stage })
    .from(schema.deals)
    .where(eq(schema.deals.patientId, patient.id))
    .orderBy(desc(schema.deals.updatedAt))
    .limit(1);

  if (latestDeal?.stage === 'presenca_confirmada') {
    await cancelReengagementSequence({ conversationId }, 'deal_presenca_confirmada');
    return;
  }

  const [recentSend] = await db
    .select({ sentAt: schema.followUps.sentAt })
    .from(schema.followUps)
    .where(
      and(
        eq(schema.followUps.conversationId, conversationId),
        eq(schema.followUps.type, 'reengagement'),
        eq(schema.followUps.status, 'sent'),
      ),
    )
    .orderBy(desc(schema.followUps.sentAt))
    .limit(1);

  const now = new Date();

  if (recentSend?.sentAt && now.getTime() - new Date(recentSend.sentAt).getTime() < MIN_STEP_GAP_MS) {
    const rescheduledFor = clampToSendWindow(new Date(new Date(recentSend.sentAt).getTime() + MIN_STEP_GAP_MS));
    await db.update(schema.followUps).set({ status: 'pending', scheduledFor: rescheduledFor }).where(eq(schema.followUps.id, followUp.id));
    console.log(`⏳ Follow-up ${followUp.id} reagendado (gap mínimo) pra ${rescheduledFor.toISOString()}`);
    return;
  }

  if (!isWithinSendWindow(now)) {
    const rescheduledFor = clampToSendWindow(now);
    await db.update(schema.followUps).set({ status: 'pending', scheduledFor: rescheduledFor }).where(eq(schema.followUps.id, followUp.id));
    console.log(`🌙 Follow-up ${followUp.id} fora da janela comercial, reagendado pra ${rescheduledFor.toISOString()}`);
    return;
  }

  if (!clinic.active || !clinic.whatsappInstanceName || !clinic.evolutionApiUrl || !clinic.evolutionApiKey) {
    await db.update(schema.followUps).set({ status: 'cancelled', metadata: { skipReason: 'clinic_not_ready' } }).where(eq(schema.followUps.id, followUp.id));
    return;
  }

  // Monta o histórico igual ao messageWorker: últimas mensagens com os
  // resultados de tool reidratados no texto.
  const allMessages = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(desc(schema.messages.createdAt));

  const recentMessages: AgentMessage[] = allMessages
    .slice(0, 20)
    .reverse()
    .filter((m) => m.role === 'patient' || m.role === 'agent')
    .map((m) => ({
      role: m.role === 'agent' ? ('assistant' as const) : ('user' as const),
      content: m.role === 'agent' ? withToolResults(m.content, m.toolCalls) : m.content,
    }));

  const lastPatientMessage = allMessages.find((m) => m.role === 'patient');
  const hoursSinceLastPatientMessage = lastPatientMessage?.createdAt
    ? (now.getTime() - new Date(lastPatientMessage.createdAt).getTime()) / 3_600_000
    : 999;

  let dynamicContext = '';
  if (clinic.agentMode === 'multi' && conversation.categoryKey) {
    const [category] = await db
      .select()
      .from(schema.agentCategories)
      .where(and(eq(schema.agentCategories.clinicId, clinic.id), eq(schema.agentCategories.key, conversation.categoryKey)))
      .limit(1);
    if (category?.systemPrompt) dynamicContext += `## Instruções específicas da clínica\n${category.systemPrompt}\n\n`;
    if (category?.knowledgeBase) dynamicContext += `## Base de conhecimento\n${category.knowledgeBase}`;
  } else {
    if (clinic.agentSystemPrompt) dynamicContext += `## Instruções específicas da clínica\n${clinic.agentSystemPrompt}\n\n`;
    if (clinic.agentKnowledgeBase) dynamicContext += `## Base de conhecimento\n${clinic.agentKnowledgeBase}`;
  }

  const meta = (followUp.metadata ?? {}) as { stepIndex?: number; totalSteps?: number };
  const stepIndex = meta.stepIndex ?? 0;
  const totalSteps = meta.totalSteps ?? REENGAGEMENT_STEPS_MS.length;
  const stepLabel = REENGAGEMENT_STEP_LABELS[stepIndex] ?? `${stepIndex + 1}ª tentativa`;

  const providerKeys = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleApiKey: process.env.GOOGLE_AI_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  };

  const decision = await decideReengagement({
    stepIndex,
    totalSteps,
    stepLabel,
    clinicName: clinic.name,
    patientName: patient.name,
    clinicConfig: (clinic.agentConfig ?? {}) as AgentConfig,
    dynamicContext,
    conversationSummary: conversation.summary,
    recentMessages,
    hoursSinceLastPatientMessage,
    nowLabel: brasiliaLabel(now),
    keys: providerKeys,
  });

  if (decision.motivo === 'erro_llm') {
    // Falha do portão (timeout, chave ausente, JSON inválido) — nunca manda
    // no escuro. Tenta de novo mais tarde em vez de desistir da conversa.
    const rescheduledFor = clampToSendWindow(new Date(now.getTime() + 30 * 60_000));
    await db.update(schema.followUps).set({ status: 'pending', scheduledFor: rescheduledFor }).where(eq(schema.followUps.id, followUp.id));
    console.log(`⚠️  Portão de decisão falhou pro follow-up ${followUp.id}, reagendado`);
    return;
  }

  if (decision.encerrar) {
    await cancelReengagementSequence({ conversationId }, `decision_encerrar: ${decision.motivo}`);
    if (/parar|não quero mais|pare de|stop|opt.?out/i.test(decision.motivo)) {
      await db.update(schema.patients).set({ reengagementOptOut: true }).where(eq(schema.patients.id, patient.id));
    }
  }

  if (!decision.enviar) {
    await db.update(schema.followUps).set({ status: 'cancelled', metadata: { ...meta, motivo: decision.motivo } }).where(eq(schema.followUps.id, followUp.id));
    console.log(`🤐 Follow-up ${followUp.id} não enviado (${decision.motivo})`);
    return;
  }

  const clinicEvolutionClient = new EvolutionClient(clinic.evolutionApiUrl, clinic.evolutionApiKey);
  const phone = patient.phone.replace(/\D/g, '');
  try {
    await sendHumanizedText(clinicEvolutionClient, { number: phone, text: decision.mensagem });

    await db.insert(schema.messages).values({
      conversationId,
      clinicId: clinic.id,
      role: 'agent',
      content: decision.mensagem,
    });
    await db
      .update(schema.conversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversationId));
    await db
      .update(schema.followUps)
      .set({ status: 'sent', sentAt: new Date(), metadata: { ...meta, motivo: decision.motivo } })
      .where(eq(schema.followUps.id, followUp.id));

    console.log(`✅ Re-engajamento (tentativa ${stepIndex + 1}/${totalSteps}) enviado a ${patient.name} (${phone})`);
  } catch (err: any) {
    console.error(`❌ Falha ao enviar re-engajamento pra ${patient.name}:`, err.message);
    if (isLastAttempt(job)) {
      await db.update(schema.followUps).set({ status: 'failed' }).where(eq(schema.followUps.id, followUp.id));
    }
    throw err;
  }
}

const REENGAGEMENT_STEP_LABELS = ['20 minutos', '2 horas', '6 horas', '24 horas', '48 horas', '4 dias', '7 dias'];

// Follow-up worker — roteia por type: reengajamento (IA decide) vs. templates
// estáticos de consulta (lembrete/pós-visita).
const followUpWorker = new Worker(
  'follow_up',
  async (job) => {
    const { followUpId } = job.data;
    console.log(`📋 Processing follow-up: ${followUpId}`);

    const results = await db
      .select({
        followUp: schema.followUps,
        patient: schema.patients,
        clinic: schema.clinics,
      })
      .from(schema.followUps)
      .innerJoin(schema.patients, eq(schema.followUps.patientId, schema.patients.id))
      .innerJoin(schema.clinics, eq(schema.followUps.clinicId, schema.clinics.id))
      .where(eq(schema.followUps.id, followUpId))
      .limit(1);

    if (!results[0]) {
      console.error(`Follow-up ${followUpId} not found`);
      return;
    }

    const { followUp, patient, clinic } = results[0];

    if (followUp.type === 'reengagement') {
      await processReengagement(followUp, patient, clinic, job);
    } else {
      await processTemplateFollowUp(followUp, patient, clinic, job);
    }
  },
  { connection, concurrency: 3 },
);

// Embedding worker
const embeddingWorker = new Worker(
  'embedding',
  async (job) => {
    const { documentId, clinicId } = job.data as { documentId: string; clinicId: string };
    console.log(`🔤 Generating embeddings for document: ${documentId}`);

    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set — skipping embeddings');
      return;
    }

    // 1. Fetch document content
    const [doc] = await db
      .select()
      .from(schema.kbDocuments)
      .where(eq(schema.kbDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      console.error(`Document ${documentId} not found`);
      return;
    }

    // 2. Delete existing chunks (re-index)
    await db.delete(schema.kbChunks).where(eq(schema.kbChunks.documentId, documentId));

    // 3. Chunk the text
    const chunks = chunkText(doc.content);
    console.log(`📄 ${chunks.length} chunks from document "${doc.title}"`);

    // 4. Generate embeddings and insert chunks
    for (const [i, chunk] of chunks.entries()) {
      try {
        const embedding = await generateEmbedding(chunk);
        await db.insert(schema.kbChunks).values({
          documentId,
          clinicId,
          content: chunk,
          embedding,
          categoryKey: doc.categoryKey,
        });
        console.log(`  ✓ Chunk ${i + 1}/${chunks.length}`);
      } catch (err: any) {
        console.error(`  ✗ Chunk ${i + 1} failed:`, err.message);
      }
    }

    console.log(`✅ Embeddings done for document: ${documentId}`);
  },
  { connection, concurrency: 2 },
);

// ==========================================
// Cron: Scan for due follow-ups every 60s
// ==========================================

async function scanDueFollowUps() {
  try {
    // Claim atômica: sem isso, dois scans dentro da mesma janela (ou dois
    // processos do worker) podiam selecionar a mesma linha "pending" e
    // enfileirar duas vezes. FOR UPDATE SKIP LOCKED garante que cada linha
    // só é reivindicada por um scan.
    const claimed = await db.execute<{ id: string; clinic_id: string; scheduled_for: string }>(sql`
      UPDATE follow_ups SET status = 'queued', queued_at = now()
      WHERE id IN (
        SELECT id FROM follow_ups
        WHERE status = 'pending' AND scheduled_for <= now()
        ORDER BY scheduled_for ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, clinic_id, scheduled_for
    `);

    const due = Array.from(claimed as unknown as Iterable<{ id: string; clinic_id: string; scheduled_for: string }>);

    if (due.length > 0) {
      console.log(`⏰ Found ${due.length} due follow-ups, enqueuing...`);
      for (const f of due) {
        // jobId inclui scheduled_for: uma linha reagendada (janela noturna,
        // gap mínimo, erro do portão de decisão) precisa de um jobId novo —
        // o BullMQ nunca recicla um jobId usado, mesmo depois de
        // completed/failed, então com jobId fixo o reagendamento viraria
        // no-op silencioso pra sempre.
        const scheduledForMs = new Date(f.scheduled_for).getTime();
        await followUpQueue.add('process', { followUpId: f.id, clinicId: f.clinic_id }, {
          jobId: `followup-${f.id}-${scheduledForMs}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60000 },
          removeOnComplete: 200,
          removeOnFail: 100,
        });
      }
    }

    // Auto-cura: se o worker morreu entre a claim e o enfileiramento, a
    // linha fica "queued" indefinidamente. Devolve pra "pending" depois de
    // 30min pra ser reivindicada de novo no próximo scan.
    await db
      .update(schema.followUps)
      .set({ status: 'pending', queuedAt: null })
      .where(
        and(
          eq(schema.followUps.status, 'queued'),
          lte(schema.followUps.queuedAt, new Date(Date.now() - 30 * 60_000)),
        ),
      );
  } catch (err: any) {
    console.error('Error scanning follow-ups:', err.message);
  }
}

setInterval(scanDueFollowUps, 60_000); // Every 60s
scanDueFollowUps(); // Run immediately on start

// ==========================================
// Error Handling
// ==========================================

for (const worker of [messageWorker, followUpWorker, embeddingWorker]) {
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed (${job.queueName})`);
  });
  worker.on('failed', (job, err) => {
    // err.message sozinho escondia a causa real de erros de serviço externo
    // (ExternalServiceError carrega status/body da resposta em `details`,
    // que não faz parte de `message`) — sem isso não dava pra saber, por
    // exemplo, por que um envio pra Evolution Go falhou.
    const details = (err as { details?: unknown }).details;
    console.error(`❌ Job ${job?.id} failed (${job?.queueName}):`, err.message, details ? JSON.stringify(details) : '');
  });
}

console.log('🚀 Workers started:');
console.log('  - process_message (concurrency: 5)');
console.log('  - follow_up (concurrency: 3) — FULLY IMPLEMENTED');
console.log('  - embedding (concurrency: 2)');
console.log('  - follow-up scanner: every 60s');
