import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { professionals } from './professionals';
import { services } from './services';

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    patientId: uuid('patient_id')
      .references(() => patients.id)
      .notNull(),
    professionalId: uuid('professional_id')
      .references(() => professionals.id)
      .notNull(),
    serviceId: uuid('service_id')
      .references(() => services.id)
      .notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('scheduled'),
    // scheduled | confirmed | completed | no_show | cancelled
    source: varchar('source', { length: 50 }).default('whatsapp_agent'),
    notes: text('notes'),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    startsAtIdx: index('appointments_clinic_starts_idx').on(t.clinicId, t.startsAt),
    professionalIdx: index('appointments_prof_starts_idx').on(t.professionalId, t.startsAt),
  }),
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
