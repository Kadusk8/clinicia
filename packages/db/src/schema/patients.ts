import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }),
    birthDate: date('birth_date'),
    email: varchar('email', { length: 255 }),
    cpf: varchar('cpf', { length: 14 }),
    insurance: varchar('insurance', { length: 100 }),
    notes: text('notes'),
    tags: text('tags').array(),
    lgpdConsent: boolean('lgpd_consent').default(false),
    lgpdConsentAt: timestamp('lgpd_consent_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    phoneIdx: uniqueIndex('patients_clinic_phone_idx').on(t.clinicId, t.phone),
  }),
);

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
