import { pgTable, uuid, varchar, text, timestamp, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(), // owner | admin | recepcao | profissional
    passwordHash: text('password_hash'),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    avatarUrl: text('avatar_url'),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_clinic_email_idx').on(t.clinicId, t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
