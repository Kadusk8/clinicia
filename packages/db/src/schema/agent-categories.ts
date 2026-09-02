import { pgTable, uuid, text, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const agentCategories = pgTable('agent_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  key: varchar('key', { length: 100 }).notNull(), // slug, ex: atm_ortognatica
  label: varchar('label', { length: 255 }).notNull(),
  systemPrompt: text('system_prompt'),
  knowledgeBase: text('knowledge_base'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type AgentCategory = typeof agentCategories.$inferSelect;
export type NewAgentCategory = typeof agentCategories.$inferInsert;
