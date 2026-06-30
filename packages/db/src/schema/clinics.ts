import { pgTable, uuid, varchar, boolean, timestamp, jsonb, text } from 'drizzle-orm/pg-core';

export const clinics = pgTable('clinics', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  type: varchar('type', { length: 50 }).notNull(), // medical | dental | other
  timezone: varchar('timezone', { length: 50 }).default('America/Sao_Paulo'),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: varchar('address', { length: 500 }),

  // WhatsApp / Evolution API (managed by super admin or clinic)
  whatsappInstanceName: varchar('whatsapp_instance_name', { length: 100 }),
  evolutionApiUrl: varchar('evolution_api_url', { length: 255 }),
  evolutionApiKey: varchar('evolution_api_key', { length: 255 }),
  whatsappConnected: boolean('whatsapp_connected').default(false),

  // Agent IA config (managed by super admin)
  agentConfig: jsonb('agent_config').default({}).notNull(),
  // agentConfig shape: { assistantName, greeting, businessHours, paymentMethods, insurances, tone }
  agentSystemPrompt: text('agent_system_prompt'),
  agentKnowledgeBase: text('agent_knowledge_base'),

  // Billing & status
  plan: varchar('plan', { length: 50 }).default('trial'), // trial | starter | pro | enterprise
  active: boolean('active').default(true),
  suspendedAt: timestamp('suspended_at'),
  suspendedReason: varchar('suspended_reason', { length: 500 }),
  trialEndsAt: timestamp('trial_ends_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Clinic = typeof clinics.$inferSelect;
export type NewClinic = typeof clinics.$inferInsert;
