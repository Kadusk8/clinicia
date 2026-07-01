import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, lte, desc } from 'drizzle-orm';
import { EvolutionClient } from '@crm-clinicas/evolution';
import { createAgent, executeToolCall, generateEmbedding, chunkText } from '@crm-clinicas/ai';
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
    const { conversationId, clinicId } = job.data as { conversationId: string; clinicId: string };
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

    // 2. Fetch last 20 messages (chronological order)
    const rawMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(20);

    rawMessages.reverse();

    // 3. Map roles for the agent (patient/staff/system → user, agent → assistant)
    const messageHistory = rawMessages
      .filter((m) => m.role === 'patient' || m.role === 'agent')
      .map((m) => ({
        role: m.role === 'agent' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));

    // 4. Build AgentContext
    const agentConfig = (clinic.agentConfig ?? {}) as AgentConfig;
    const clinicName = clinic.name;
    const patientPhone = conversation.externalId ?? '';

    const context = {
      clinicId,
      conversationId,
      patientPhone,
      clinicConfig: agentConfig,
      clinicName,
      dynamicContext: clinic.agentKnowledgeBase ?? '',
    };

    // 5. Run agent
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return;
    }

    const agent = createAgent(apiKey);
    const result = await agent.processConversation(context, messageHistory, (name, input, ctx) =>
      executeToolCall(name, input, {
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        patientPhone: ctx.patientPhone,
        clinicConfig: ctx.clinicConfig,
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
    await clinicEvolutionClient.sendText({
      instanceName: clinic.whatsappInstanceName!,
      remoteJid: phone,
      text: result.response,
    });
    console.log(`✅ Agent reply sent to ${phone} (conversation: ${conversationId})`);
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
      await clinicEvolutionClient.sendText({
        instanceName: clinic.whatsappInstanceName!,
        remoteJid: phone,
        text: message,
      });
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
          role: 'assistant',
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

setInterval(scanDueFollowUps, 60_000); // Every 60 seconds
scanDueFollowUps(); // Run immediately on start

// ==========================================
// Error Handling
// ==========================================

for (const worker of [messageWorker, followUpWorker, embeddingWorker]) {
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed (${job.queueName})`);
  });
  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed (${job?.queueName}):`, err.message);
  });
}

console.log('🚀 Workers started:');
console.log('  - process_message (concurrency: 5)');
console.log('  - follow_up (concurrency: 3) — FULLY IMPLEMENTED');
console.log('  - embedding (concurrency: 2)');
console.log('  - follow-up scanner: every 60s');
