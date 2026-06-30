import { pgTable, uuid, varchar, jsonb } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { users } from './users';

export const professionals = pgTable('professionals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  speciality: varchar('speciality', { length: 100 }),
  registration: varchar('registration', { length: 50 }), // CRM, CRO, etc.
  googleCalendarId: varchar('google_calendar_id', { length: 255 }),
  workingHours: jsonb('working_hours').default({}),
  // workingHours shape: { mon: [{start: "08:00", end: "12:00"}, {start: "14:00", end: "18:00"}], ... }
  active: jsonb('active').default(true),
});

export type Professional = typeof professionals.$inferSelect;
export type NewProfessional = typeof professionals.$inferInsert;
