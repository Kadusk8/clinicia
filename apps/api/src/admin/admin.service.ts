import { Injectable, Logger } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, desc, sql, ilike, or } from 'drizzle-orm';
import { NotFoundError } from '@crm-clinicas/shared';
import { EvolutionClient } from '@crm-clinicas/evolution';
import * as crypto from 'crypto';
import { Scrypt } from 'oslo/password';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const scrypt = new Scrypt();

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  // ==========================================
  // Super Admin Auth
  // ==========================================

  async loginSuperAdmin(email: string, password: string) {
    const hash = hashPassword(password);
    const result = await db
      .select()
      .from(schema.superAdmins)
      .where(eq(schema.superAdmins.email, email))
      .limit(1);

    if (!result[0] || result[0].passwordHash !== hash) {
      return null;
    }

    return result[0];
  }

  async createSuperAdmin(email: string, name: string, password: string) {
    const hash = hashPassword(password);
    const result = await db
      .insert(schema.superAdmins)
      .values({ email, name, passwordHash: hash })
      .returning();
    return result[0]!;
  }

  // ==========================================
  // Clinics CRUD
  // ==========================================

  async listClinics(search?: string) {
    let query = db.select().from(schema.clinics).orderBy(desc(schema.clinics.createdAt));

    if (search) {
      const results = await db
        .select()
        .from(schema.clinics)
        .where(
          or(
            ilike(schema.clinics.name, `%${search}%`),
            ilike(schema.clinics.email, `%${search}%`),
          ),
        )
        .orderBy(desc(schema.clinics.createdAt));
      return results;
    }

    return await query;
  }

  async getClinic(id: string) {
    const result = await db
      .select()
      .from(schema.clinics)
      .where(eq(schema.clinics.id, id))
      .limit(1);

    if (!result[0]) throw new NotFoundError('Clínica', id);
    return result[0];
  }

  async getClinicWithUsers(id: string) {
    const clinic = await this.getClinic(id);
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clinicId, id));

    return { ...clinic, users };
  }

  async getClinicStats(id: string) {
    const [patients, appointments, conversations, deals] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.patients).where(eq(schema.patients.clinicId, id)),
      db.select({ count: sql<number>`count(*)` }).from(schema.appointments).where(eq(schema.appointments.clinicId, id)),
      db.select({ count: sql<number>`count(*)` }).from(schema.conversations).where(eq(schema.conversations.clinicId, id)),
      db.select({ count: sql<number>`count(*)` }).from(schema.deals).where(eq(schema.deals.clinicId, id)),
    ]);

    return {
      patients: Number(patients[0]?.count ?? 0),
      appointments: Number(appointments[0]?.count ?? 0),
      conversations: Number(conversations[0]?.count ?? 0),
      deals: Number(deals[0]?.count ?? 0),
    };
  }

  async createClinic(data: {
    name: string;
    slug: string;
    type: string;
    phone?: string;
    email?: string;
    address?: string;
    plan?: string;
    // Agent config
    agentConfig?: Record<string, unknown>;
    agentSystemPrompt?: string;
    agentKnowledgeBase?: string;
    // Owner user
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  }) {
    this.logger.log(`Creating clinic: ${data.name}`);

    return await db.transaction(async (tx) => {
      const clinic = await tx
        .insert(schema.clinics)
        .values({
          name: data.name,
          slug: data.slug,
          type: data.type,
          phone: data.phone,
          email: data.email,
          address: data.address,
          plan: data.plan || 'trial',
          agentConfig: data.agentConfig || {},
          agentSystemPrompt: data.agentSystemPrompt,
          agentKnowledgeBase: data.agentKnowledgeBase,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        })
        .returning();

      const clinicId = clinic[0]!.id;

      const owner = await tx
        .insert(schema.users)
        .values({
          clinicId,
          email: data.ownerEmail,
          name: data.ownerName,
          role: 'owner',
        })
        .returning();

      const betterAuthHash = await scrypt.hash(data.ownerPassword);
      await tx.insert(schema.account).values({
        id: crypto.randomUUID(),
        accountId: owner[0]!.id,
        providerId: 'credential',
        userId: owner[0]!.id,
        password: betterAuthHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { clinic: clinic[0]!, owner: owner[0]! };
    });
  }

  async updateClinic(id: string, data: Partial<schema.NewClinic>) {
    const result = await db
      .update(schema.clinics)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.clinics.id, id))
      .returning();

    if (!result[0]) throw new NotFoundError('Clínica', id);
    return result[0];
  }

  async deleteClinic(id: string) {
    this.logger.warn(`Deleting clinic ${id} and ALL related data`);

    // Get user IDs before deleting users (needed to clean account table)
    const clinicUsers = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.clinicId, id));

    await db.delete(schema.messages).where(eq(schema.messages.clinicId, id));
    await db.delete(schema.conversations).where(eq(schema.conversations.clinicId, id));
    await db.delete(schema.followUps).where(eq(schema.followUps.clinicId, id));
    await db.delete(schema.appointments).where(eq(schema.appointments.clinicId, id));
    await db.delete(schema.deals).where(eq(schema.deals.clinicId, id));
    await db.delete(schema.kbChunks).where(eq(schema.kbChunks.clinicId, id));
    await db.delete(schema.kbDocuments).where(eq(schema.kbDocuments.clinicId, id));
    await db.delete(schema.patients).where(eq(schema.patients.clinicId, id));
    await db.delete(schema.professionals).where(eq(schema.professionals.clinicId, id));
    await db.delete(schema.services).where(eq(schema.services.clinicId, id));
    await db.delete(schema.auditLog).where(eq(schema.auditLog.clinicId, id));

    // Delete account entries (FK → users.id, no cascade)
    for (const u of clinicUsers) {
      await db.delete(schema.account).where(eq(schema.account.userId, u.id));
    }
    await db.delete(schema.users).where(eq(schema.users.clinicId, id));
    await db.delete(schema.clinics).where(eq(schema.clinics.id, id));

    return { deleted: true };
  }

  async suspendClinic(id: string, reason: string) {
    return this.updateClinic(id, {
      active: false,
      suspendedAt: new Date(),
      suspendedReason: reason,
    } as Partial<schema.NewClinic>);
  }

  async reactivateClinic(id: string) {
    return this.updateClinic(id, {
      active: true,
      suspendedAt: null,
      suspendedReason: null,
    } as Partial<schema.NewClinic>);
  }

  async updateAgentConfig(id: string, data: {
    agentConfig?: Record<string, unknown>;
    agentSystemPrompt?: string;
    agentKnowledgeBase?: string;
  }) {
    return this.updateClinic(id, data as Partial<schema.NewClinic>);
  }

  async updateWhatsApp(id: string, data: {
    whatsappInstanceName?: string;
    evolutionApiUrl?: string;
    evolutionApiKey?: string;
    whatsappConnected?: boolean;
  }) {
    const clinic = await this.updateClinic(id, data as Partial<schema.NewClinic>);

    // Auto-configure Webhook in Evolution Go
    if (data.evolutionApiUrl && data.evolutionApiKey && data.whatsappInstanceName) {
      try {
        const client = new EvolutionClient(data.evolutionApiUrl, data.evolutionApiKey);
        const apiUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        const webhookUrl = `${apiUrl}/api/webhooks/evolution/${data.whatsappInstanceName}`;
        
        await client.setWebhook(data.whatsappInstanceName, webhookUrl, [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE'
        ]);
        this.logger.log(`Webhook configured for instance ${data.whatsappInstanceName} -> ${webhookUrl}`);
      } catch (error) {
        this.logger.error(`Failed to configure webhook for instance ${data.whatsappInstanceName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return clinic;
  }

  // ==========================================
  // Dashboard Stats
  // ==========================================

  async getDashboardStats() {
    const [clinics, activeCount, suspendedCount, totalPatients] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.clinics),
      db.select({ count: sql<number>`count(*)` }).from(schema.clinics).where(eq(schema.clinics.active, true)),
      db.select({ count: sql<number>`count(*)` }).from(schema.clinics).where(eq(schema.clinics.active, false)),
      db.select({ count: sql<number>`count(*)` }).from(schema.patients),
    ]);

    return {
      totalClinics: Number(clinics[0]?.count ?? 0),
      activeClinics: Number(activeCount[0]?.count ?? 0),
      suspendedClinics: Number(suspendedCount[0]?.count ?? 0),
      totalPatients: Number(totalPatients[0]?.count ?? 0),
    };
  }
}
