import { pgTable, uuid, varchar, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { services } from './services';
import { users } from './users';

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  patientId: uuid('patient_id')
    .references(() => patients.id)
    .notNull(),
  serviceId: uuid('service_id').references(() => services.id),
  stage: varchar('stage', { length: 50 }).notNull(),
  // lead | qualified | scheduled | attended | treatment | won | lost
  valueCents: integer('value_cents'),
  ownerId: uuid('owner_id').references(() => users.id),
  lostReason: text('lost_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
