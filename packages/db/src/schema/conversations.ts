import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { users } from './users';

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  patientId: uuid('patient_id').references(() => patients.id),
  channel: varchar('channel', { length: 30 }).default('whatsapp'),
  externalId: varchar('external_id', { length: 100 }), // remoteJid from Evolution
  status: varchar('status', { length: 30 }).default('agent_active'),
  // agent_active | human_active | closed
  assignedUserId: uuid('assigned_user_id').references(() => users.id),
  summary: text('summary'), // LLM-generated conversation summary
  unreadCount: integer('unread_count').default(0),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .references(() => conversations.id)
    .notNull(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  role: varchar('role', { length: 30 }).notNull(),
  // patient | agent | staff | system
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  mediaType: varchar('media_type', { length: 50 }),
  toolCalls: jsonb('tool_calls'), // tool use payload from this turn
  externalId: varchar('external_id', { length: 100 }), // WhatsApp message ID
  createdAt: timestamp('created_at').defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
