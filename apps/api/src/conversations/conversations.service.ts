import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { NotFoundError, type PaginationInput } from '@crm-clinicas/shared';
import { EvolutionClient } from '@crm-clinicas/evolution';

@Injectable()
export class ConversationsService {

  async findAll(clinicId: string, pagination: PaginationInput) {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.clinicId, clinicId))
        .orderBy(desc(schema.conversations.lastMessageAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.conversations)
        .where(eq(schema.conversations.clinicId, clinicId)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(clinicId: string, id: string) {
    const result = await db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.clinicId, clinicId),
          eq(schema.conversations.id, id),
        ),
      )
      .limit(1);

    if (!result[0]) throw new NotFoundError('Conversa', id);
    return result[0];
  }

  async getMessages(conversationId: string, clinicId: string) {
    return db
      .select()
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          eq(schema.messages.clinicId, clinicId),
        ),
      )
      .orderBy(schema.messages.createdAt);
  }

  async findOrCreateByPhone(clinicId: string, phone: string, patientId?: string) {
    // Try to find existing conversation
    const existing = await db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.clinicId, clinicId),
          eq(schema.conversations.externalId, phone),
        ),
      )
      .limit(1);

    if (existing[0]) return existing[0];

    // Create new conversation
    const result = await db
      .insert(schema.conversations)
      .values({
        clinicId,
        patientId,
        externalId: phone,
        status: 'agent_active',
        lastMessageAt: new Date(),
      })
      .returning();

    return result[0]!;
  }

  async addMessage(data: schema.NewMessage) {
    const result = await db.insert(schema.messages).values(data).returning();

    // Update conversation lastMessageAt and unreadCount
    await db
      .update(schema.conversations)
      .set({
        lastMessageAt: new Date(),
        unreadCount: sql`${schema.conversations.unreadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.conversations.id, data.conversationId));

    return result[0]!;
  }

  async takeover(clinicId: string, conversationId: string, userId: string) {
    return db
      .update(schema.conversations)
      .set({
        status: 'human_active',
        assignedUserId: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.conversations.clinicId, clinicId),
          eq(schema.conversations.id, conversationId),
        ),
      )
      .returning();
  }

  async returnToAgent(clinicId: string, conversationId: string) {
    return db
      .update(schema.conversations)
      .set({
        status: 'agent_active',
        assignedUserId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.conversations.clinicId, clinicId),
          eq(schema.conversations.id, conversationId),
        ),
      )
      .returning();
  }

  async sendStaffMessage(clinicId: string, conversationId: string, content: string): Promise<schema.Message> {
    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.clinicId, clinicId), eq(schema.conversations.id, conversationId)))
      .limit(1);

    if (!conversation) throw new NotFoundError('Conversa', conversationId);

    const [clinic] = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.id, clinicId))
      .limit(1);

    const message = await this.addMessage({
      conversationId,
      clinicId,
      role: 'staff',
      content,
    });

    // Send via Evolution Go if WhatsApp is configured for this clinic
    if (clinic?.whatsappInstanceName && clinic.evolutionApiUrl && clinic.evolutionApiKey && conversation.externalId) {
      const client = new EvolutionClient(clinic.evolutionApiUrl, clinic.evolutionApiKey);
      const phone = conversation.externalId.replace(/\D/g, '');
      await client.sendText({
        instanceName: clinic.whatsappInstanceName,
        remoteJid: phone,
        text: content,
      }).catch((err: Error) => {
        // Log but don't fail the request — message is already persisted
        console.error('Failed to send via WhatsApp:', err.message);
      });
    }

    return message;
  }

  async markAsRead(clinicId: string, conversationId: string): Promise<void> {
    await db
      .update(schema.conversations)
      .set({ unreadCount: 0 })
      .where(
        and(
          eq(schema.conversations.clinicId, clinicId),
          eq(schema.conversations.id, conversationId),
        ),
      );
  }
}
