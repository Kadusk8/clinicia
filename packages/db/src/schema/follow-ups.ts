import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';
import { patients } from './patients';
import { appointments } from './appointments';
import { conversations } from './conversations';

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
    // Só preenchido em follow-ups de re-engajamento (type='reengagement') —
    // é por onde o cancelamento (paciente respondeu, transferiu pra humano,
    // etc.) acha as linhas certas. Follow-up de consulta não precisa: já tem
    // appointmentId.
    conversationId: uuid('conversation_id').references(() => conversations.id),
    type: varchar('type', { length: 50 }).notNull(),
    // reminder_24h | reminder_2h | post_visit | reactivation | no_show | reengagement
    // scheduledFor/sentAt em timestamptz: a sequência de re-engajamento tem
    // que respeitar hora de parede de São Paulo (janela 08h-20h), então o
    // fuso não pode ficar implícito no timezone do processo que gravou.
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    templateKey: varchar('template_key', { length: 100 }),
    status: varchar('status', { length: 30 }).default('pending'),
    // pending | queued | sent | failed | cancelled
    // Só setado quando o scanner reivindica a linha (status='queued') — usado
    // pra detectar e devolver pra "pending" uma linha que ficou presa em
    // "queued" (worker morreu entre a claim e o enfileiramento no BullMQ).
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    scheduledIdx: index('follow_ups_scheduled_idx').on(t.status, t.scheduledFor),
    conversationIdx: index('follow_ups_conv_idx').on(t.conversationId, t.type, t.status),
  }),
);

export type FollowUp = typeof followUps.$inferSelect;
export type NewFollowUp = typeof followUps.$inferInsert;
