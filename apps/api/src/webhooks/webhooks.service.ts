import { Injectable, Logger, Inject } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { and, eq, sql } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import type { WebhookPayload } from '@crm-clinicas/evolution';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(@Inject('MESSAGE_QUEUE') private readonly messageQueue: Queue) {}

  async processEvolutionWebhook(instanceName: string, payload: WebhookPayload) {
    this.logger.log(`Webhook received for instance: ${instanceName}, event: ${payload.event}`);

    if (payload.event !== 'messages.upsert') {
      this.logger.debug(`Ignoring event: ${payload.event}`);
      return;
    }

    const message = payload.data;

    // Ignore outgoing messages
    if (message.key.fromMe) return;

    // Ignore group messages
    const remoteJid = message.key.remoteJid;
    if (remoteJid.endsWith('@g.us')) {
      this.logger.debug(`Ignoring group message from: ${remoteJid}`);
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
    const phone = remoteJid.replace('@s.whatsapp.net', '');

    // Extract message content
    const content =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
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
      externalId: message.key.id,
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

    // 4. Enqueue for AI processing (only if agent is in control)
    if (conversationStatus !== 'agent_active') {
      this.logger.log(`Conversation ${conversationId} is ${conversationStatus}, skipping AI`);
      return { processed: true, clinicId, phone, aiSkipped: true };
    }

    // jobId fixo por conversa = debounce nativo do BullMQ (substitui job pendente dentro do delay)
    await this.messageQueue.add(
      'process',
      { conversationId, clinicId },
      {
        jobId: `msg-${conversationId}`,
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
        conversationStatus: existing[0].status ?? 'agent_active',
      };
    }

    const rows = await db
      .insert(schema.conversations)
      .values({
        clinicId,
        patientId,
        externalId: phone,
        channel: 'whatsapp',
        status: 'agent_active',
        lastMessageAt: new Date(),
      })
      .returning({ id: schema.conversations.id, status: schema.conversations.status });

    const inserted = rows[0]!;
    return {
      conversationId: inserted.id,
      conversationStatus: inserted.status ?? 'agent_active',
    };
  }
}
