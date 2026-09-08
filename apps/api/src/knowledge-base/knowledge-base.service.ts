import { Injectable, Inject } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and, isNull } from 'drizzle-orm';
import { NotFoundError } from '@crm-clinicas/shared';
import type { Queue } from 'bullmq';

@Injectable()
export class KnowledgeBaseService {
  constructor(@Inject('EMBEDDING_QUEUE') private readonly embeddingQueue: Queue) {}

  // `categoryKey` filters by scope: undefined = todos os documentos da clínica,
  // null = só os gerais (category_key IS NULL), string = só os daquela categoria.
  async findAll(clinicId: string, categoryKey?: string | null) {
    const conditions = [eq(schema.kbDocuments.clinicId, clinicId)];
    if (categoryKey !== undefined) {
      conditions.push(
        categoryKey === null
          ? isNull(schema.kbDocuments.categoryKey)
          : eq(schema.kbDocuments.categoryKey, categoryKey),
      );
    }

    return db
      .select({
        id: schema.kbDocuments.id,
        title: schema.kbDocuments.title,
        source: schema.kbDocuments.source,
        categoryKey: schema.kbDocuments.categoryKey,
        createdAt: schema.kbDocuments.createdAt,
        updatedAt: schema.kbDocuments.updatedAt,
      })
      .from(schema.kbDocuments)
      .where(and(...conditions))
      .orderBy(schema.kbDocuments.createdAt);
  }

  async create(
    clinicId: string,
    title: string,
    content: string,
    source = 'upload',
    categoryKey?: string | null,
  ): Promise<schema.KbDocument> {
    const [doc] = await db
      .insert(schema.kbDocuments)
      .values({ clinicId, title, content, source, categoryKey: categoryKey ?? null })
      .returning();

    // Enqueue embedding generation asynchronously
    await this.embeddingQueue.add(
      'process',
      { documentId: doc!.id, clinicId },
      { jobId: `embed-${doc!.id}`, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return doc!;
  }

  async delete(clinicId: string, id: string): Promise<void> {
    // Delete chunks first (FK constraint)
    await db.delete(schema.kbChunks).where(eq(schema.kbChunks.documentId, id));

    const [deleted] = await db
      .delete(schema.kbDocuments)
      .where(and(eq(schema.kbDocuments.clinicId, clinicId), eq(schema.kbDocuments.id, id)))
      .returning();

    if (!deleted) throw new NotFoundError('Documento', id);
  }
}
