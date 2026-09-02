import { Injectable, Logger, Inject } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { and, eq, sql } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import type { WebhookPayload, WebhookMessageData, WebhookConnectionData } from '@crm-clinicas/evolution';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(@Inject('MESSAGE_QUEUE') private readonly messageQueue: Queue) {}

  async getClinicApiKey(instanceName: string): Promise<string | null> {
    const [clinic] = await db
      .select({ evolutionApiKey: schema.clinics.evolutionApiKey })
      .from(schema.clinics)
      .where(eq(schema.clinics.whatsappInstanceName, instanceName))
      .limit(1);
    return clinic?.evolutionApiKey ?? null;
  }

  async processEvolutionWebhook(instanceName: string, payload: WebhookPayload) {
    this.logger.log(`Webhook received for instance: ${instanceName}, event: ${payload.event}`);

    // Connection state events — update whatsappConnected in real time instead
    // of relying only on the one-shot check done when saving the integration.
    if (payload.event === 'Connected' || payload.event === 'LoggedOut' || payload.event === 'PairSuccess') {
      const data = payload.data as WebhookConnectionData;
      await db
        .update(schema.clinics)
        .set({ whatsappConnected: payload.event !== 'LoggedOut' && data.status !== 'close' })
        .where(eq(schema.clinics.whatsappInstanceName, instanceName));
      return;
    }

    if (payload.event !== 'Message') {
      this.logger.debug(`Ignoring event: ${payload.event}`);
      return;
    }

    const message = payload.data as WebhookMessageData;

    // Ignore outgoing messages
    if (message.Info.IsFromMe) return;

    // Ignore group messages
    if (message.Info.IsGroup) {
      this.logger.debug(`Ignoring group message from: ${message.Info.Chat}`);
      return;
    }

    // Find clinic by instance name
    const [clinic] = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.whatsappInstanceName, instanceName))
      .limit(1);

    if (!clinic) {
      this.logger.warn(`No clinic found for instance: ${instanceName}`);
      return;
    }

    if (!clinic.active) {
      this.logger.debug(`Clinic ${clinic.name} is suspended, ignoring`);
      return;
    }

    const clinicId = clinic.id;
    // Sender JID looks like "5511999998888:1@s.whatsapp.net" — strip device suffix and domain.
    const phone = message.Info.Sender.split('@')[0]!.split(':')[0]!;

    // Extract message content
    const content =
      message.Message?.conversation ||
      message.Message?.extendedTextMessage?.text ||
      '[Mídia recebida]';

    this.logger.log(`Message from ${phone}: ${content.substring(0, 100)}`);

    // 1. Find or create patient
    const patientId = await this.findOrCreatePatient(clinicId, phone);

    // 2. Find or create conversation
    const { conversationId, conversationStatus } = await this.findOrCreateConversation(
      clinicId,
      patientId,
      phone,
    );

    // 3. Persist patient message
    await db.insert(schema.messages).values({
      conversationId,
      clinicId,
      role: 'patient',
      content,
      externalId: message.Info.ID,
    });

    // Update conversation metadata
    await db
      .update(schema.conversations)
      .set({
        lastMessageAt: new Date(),
        unreadCount: sql`unread_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.conversations.id, conversationId));

    // 4. Gate: conversas nascem human_active. Só viram agent_active quando a
    // mensagem bate com um gatilho de ativação da clínica — fail-safe pra
    // clínicas com base de pacientes antiga que não sabem que a IA existe.
    let effectiveStatus = conversationStatus;
    let triggeredCategoryKey: string | null = null;
    if (effectiveStatus !== 'agent_active') {
      const matchedTrigger = await this.matchActivationTrigger(clinicId, content);
      if (matchedTrigger) {
        triggeredCategoryKey = matchedTrigger.categoryKey;
        await db
          .update(schema.conversations)
          .set({
            status: 'agent_active',
            ...(triggeredCategoryKey ? { categoryKey: triggeredCategoryKey } : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.conversations.id, conversationId));
        effectiveStatus = 'agent_active';
      }
    }

    // 5. Enqueue for AI processing (only if agent is in control)
    if (effectiveStatus !== 'agent_active') {
      this.logger.log(`Conversation ${conversationId} is ${effectiveStatus}, skipping AI`);
      return { processed: true, clinicId, phone, aiSkipped: true };
    }

    // jobId fixo por conversa = debounce nativo do BullMQ (substitui job pendente dentro do delay).
    // BullMQ nunca recicla um jobId já usado, mesmo depois de completed/failed — sem essa
    // remoção explícita, só a primeira mensagem de cada conversa era processada e todas as
    // seguintes viravam no-op silencioso (add() resolve normalmente sem criar o job).
    const jobId = `msg-${conversationId}`;
    const existingJob = await this.messageQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state !== 'active') {
        await existingJob.remove();
      }
    }

    await this.messageQueue.add(
      'process',
      { conversationId, clinicId, triggeredCategoryKey },
      {
        jobId,
        delay: 8_000,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(`Job enqueued for conversation: ${conversationId}`);
    return { processed: true, clinicId, phone };
  }

  private async findOrCreatePatient(clinicId: string, phone: string): Promise<string> {
    const existing = await db
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.phone, phone)))
      .limit(1);

    if (existing[0]) return existing[0].id;

    const inserted = await db
      .insert(schema.patients)
      .values({ clinicId, phone, lgpdConsent: false })
      .onConflictDoNothing()
      .returning({ id: schema.patients.id });

    if (inserted[0]) return inserted[0].id;

    // Race condition: re-fetch
    const retry = await db
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.phone, phone)))
      .limit(1);

    return retry[0]!.id;
  }

  private async findOrCreateConversation(
    clinicId: string,
    patientId: string,
    phone: string,
  ): Promise<{ conversationId: string; conversationStatus: string }> {
    const existing = await db
      .select({ id: schema.conversations.id, status: schema.conversations.status })
      .from(schema.conversations)
      .where(
        and(eq(schema.conversations.clinicId, clinicId), eq(schema.conversations.externalId, phone)),
      )
      .limit(1);

    if (existing[0]) {
      return {
        conversationId: existing[0].id,
        conversationStatus: existing[0].status ?? 'human_active',
      };
    }

    const rows = await db
      .insert(schema.conversations)
      .values({
        clinicId,
        patientId,
        externalId: phone,
        channel: 'whatsapp',
        status: 'human_active',
        lastMessageAt: new Date(),
      })
      .returning({ id: schema.conversations.id, status: schema.conversations.status });

    const inserted = rows[0]!;
    return {
      conversationId: inserted.id,
      conversationStatus: inserted.status ?? 'human_active',
    };
  }

  /**
   * Compara o texto recebido (case-insensitive, substring) contra os gatilhos
   * ativos da clínica. Retorna o primeiro que bater, ou null se nenhum bater.
   */
  private async matchActivationTrigger(
    clinicId: string,
    content: string,
  ): Promise<schema.ActivationTrigger | null> {
    const triggers = await db
      .select()
      .from(schema.activationTriggers)
      .where(
        and(
          eq(schema.activationTriggers.clinicId, clinicId),
          eq(schema.activationTriggers.active, true),
        ),
      );

    const normalizedContent = content.toLowerCase();
    return triggers.find((t) => normalizedContent.includes(t.phrase.toLowerCase())) ?? null;
  }
}
