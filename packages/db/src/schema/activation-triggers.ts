import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const activationTriggers = pgTable('activation_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  phrase: text('phrase').notNull(),
  categoryKey: text('category_key'), // preenchido quando a Feature de multi-agente existir
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type ActivationTrigger = typeof activationTriggers.$inferSelect;
export type NewActivationTrigger = typeof activationTriggers.$inferInsert;
