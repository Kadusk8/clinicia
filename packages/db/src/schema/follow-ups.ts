import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { appointments } from './appointments';

export const followUps = pgTable(
  'follow_ups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id)
      .notNull(),
    appointmentId: uuid('appointment_id').references(() => appointments.id),
    type: varchar('type', { length: 50 }).notNull(),
    // reminder_24h | reminder_2h | post_visit | reactivation | no_show
    scheduledFor: timestamp('scheduled_for').notNull(),
    templateKey: varchar('template_key', { length: 100 }),
    status: varchar('status', { length: 30 }).default('pending'),
    // pending | sent | failed | cancelled
    sentAt: timestamp('sent_at'),
    metadata: jsonb('metadata'),
  },
  (t) => ({
    scheduledIdx: index('follow_ups_scheduled_idx').on(t.status, t.scheduledFor),
  }),
);

export type FollowUp = typeof followUps.$inferSelect;
export type NewFollowUp = typeof followUps.$inferInsert;
