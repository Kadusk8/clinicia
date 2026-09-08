import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, lte, desc } from 'drizzle-orm';
import { EvolutionClient } from '@crm-clinicas/evolution';
import {
  createAgent,
  executeToolCall,
  generateEmbedding,
  chunkText,
  buildMessageWindow,
  shouldRegenerateSummary,
  buildSummaryPrompt,
  classifyCategory,
} from '@crm-clinicas/ai';
import type { AgentConfig } from '@crm-clinicas/shared';

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

/**
 * O modelo respondia com o texto inteiro (às vezes vários parágrafos) numa
 * única mensagem de WhatsApp — lido como um bloco de texto grande, nada
 * parecido com a forma como uma pessoa realmente conversa por lá. Quebra a
 * resposta em balões menores nas quebras de parágrafo (linha em branco), e
 * quando mesmo assim um parágrafo sozinho passa do limite de caracteres de um
 * balão (o modelo nem sempre respeita "mensagens curtas" do prompt — pedir
 * não é garantir), quebra também por frase. Cada balão final vira um envio
 * separado, com uma pequena pausa entre eles pra simular alguém digitando.
 */
const MAX_BUBBLE_CHARS = 220;

function splitIntoWhatsAppMessages(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.flatMap((paragraph) =>
    paragraph.length <= MAX_BUBBLE_CHARS ? [paragraph] : splitBySentence(paragraph),
  );
}

function splitBySentence(paragraph: string): string[] {
  // Mantém pontuação final ao separar (. ! ?) — sem isso a frase perde o ponto.
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [paragraph];
  const bubbles: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current && current.length + 1 + sentence.length > MAX_BUBBLE_CHARS) {
      bubbles.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) bubbles.push(current);
  return bubbles;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tempo de "digitando..." proporcional ao tamanho do balão, pra parecer
// alguém escrevendo de verdade em vez de um robô respondendo instantâneo.
function typingDelayFor(text: string): number {
  return Math.min(3000, Math.max(900, 700 + text.length * 12));
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
    const bubbles = splitIntoWhatsAppMessages(result.response);
    for (const bubble of bubbles) {
      const typingMs = typingDelayFor(bubble);
      // "digitando..." é cosmético — se a Evolution Go rejeitar essa chamada,
      // a mensagem real ainda tem que sair.
      try {
        await clinicEvolutionClient.sendPresence({ number: phone, state: 'composing', delay: typingMs });
      } catch (e) {
        console.error('Falha ao enviar indicador de "digitando" (ignorado):', (e as Error).message);
      }
      await sleep(typingMs);
      await clinicEvolutionClient.sendText({ number: phone, text: bubble });
    }
    console.log(`✅ Agent reply sent to ${phone} in ${bubbles.length} message(s) (conversation: ${conversationId})`);
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

// Follow-up worker — FULLY IMPLEMENTED
const followUpWorker = new Worker(
  'follow_up',
  async (job) => {
    const { followUpId } = job.data;
    console.log(`📋 Processing follow-up: ${followUpId}`);

    // 1. Load follow-up with patient, clinic, and appointment data
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

    // 2. Check if clinic is active and has WhatsApp
    if (!clinic.active) {
      console.log(`Clinic ${clinic.name} is suspended, skipping`);
      await db.update(schema.followUps).set({ status: 'cancelled' }).where(eq(schema.followUps.id, followUpId));
      return;
    }

    if (!clinic.whatsappInstanceName) {
      console.log(`Clinic ${clinic.name} has no WhatsApp instance, skipping`);
      return;
    }

    // 3. Get appointment details if exists
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

    // 4. Generate message
    const templateKey = followUp.templateKey || followUp.type;
    const template = TEMPLATES[templateKey];
    const patientName = patient.name ?? 'paciente';
    const message = template
      ? template(patientName, clinic.name, appointmentDate, serviceName)
      : `Olá ${patientName}! A ${clinic.name} tem uma mensagem para você.`;

    // 5. Send via Evolution Go using clinic-specific credentials
    if (!clinic.evolutionApiUrl || !clinic.evolutionApiKey) {
      console.log(`Clinic ${clinic.name} has no Evolution Go credentials, skipping`);
      return;
    }
    const clinicEvolutionClient = new EvolutionClient(clinic.evolutionApiUrl, clinic.evolutionApiKey);
    try {
      const phone = patient.phone.replace(/\D/g, '');
      await clinicEvolutionClient.sendText({ number: phone, text: message });
      console.log(`✅ Follow-up sent to ${patient.name} (${phone})`);

      // 6. Mark as sent
      await db.update(schema.followUps).set({ status: 'sent', sentAt: new Date() }).where(eq(schema.followUps.id, followUpId));

      // 7. Log the message in conversation (if exists)
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
      await db.update(schema.followUps).set({ status: 'failed' }).where(eq(schema.followUps.id, followUpId));
      throw err; // BullMQ will retry
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
    const due = await db
      .select()
      .from(schema.followUps)
      .where(
        and(
          eq(schema.followUps.status, 'pending'),
          lte(schema.followUps.scheduledFor, new Date()),
        ),
      )
      .limit(20);

    if (due.length > 0) {
      console.log(`⏰ Found ${due.length} due follow-ups, enqueuing...`);
      for (const f of due) {
        await followUpQueue.add('process', { followUpId: f.id, clinicId: f.clinicId }, {
          jobId: `followup-${f.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60000 },
        });
      }
    }
  } catch (err: any) {
    console.error('Error scanning follow-ups:', err.message);
  }
}

setInterval(scanDueFollowUps, 5 * 60_000); // Every 5 minutes
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
