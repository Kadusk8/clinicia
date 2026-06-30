import { pgTable, uuid, varchar, text, timestamp, index, customType } from 'drizzle-orm/pg-core';
import { clinics } from './clinics';

// Custom type for pgvector
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    return String(value)
      .slice(1, -1)
      .split(',')
      .map(Number);
  },
});

export const kbDocuments = pgTable('kb_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  source: varchar('source', { length: 100 }), // upload | onboarding | manual
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const kbChunks = pgTable(
  'kb_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .references(() => kbDocuments.id)
      .notNull(),
    clinicId: uuid('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding'),
  },
  (t) => ({
    // HNSW index for fast cosine similarity search
    embeddingIdx: index('kb_chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  }),
);

export type KbDocument = typeof kbDocuments.$inferSelect;
export type NewKbDocument = typeof kbDocuments.$inferInsert;
export type KbChunk = typeof kbChunks.$inferSelect;
export type NewKbChunk = typeof kbChunks.$inferInsert;
