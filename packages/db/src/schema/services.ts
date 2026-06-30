import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  durationMin: integer('duration_min').notNull(),
  priceCents: integer('price_cents'),
  acceptsInsurance: boolean('accepts_insurance').default(false),
  insurancePlans: text('insurance_plans').array(),
  active: boolean('active').default(true),
});

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

// Junction table for many-to-many professionals <-> services
// Imported here to avoid circular dependency
import { professionals } from './professionals';

export const professionalServices = pgTable(
  'professional_services',
  {
    professionalId: uuid('professional_id')
      .references(() => professionals.id)
      .notNull(),
    serviceId: uuid('service_id')
      .references(() => services.id)
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.professionalId, t.serviceId] }),
  }),
);
