import { Injectable } from '@nestjs/common';
import { db, schema } from '@crm-clinicas/db';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '@crm-clinicas/shared';

@Injectable()
export class KnowledgeBaseService {
  async findAll(clinicId: string) {
    return db
      .select({
        id: schema.kbDocuments.id,
        title: schema.kbDocuments.title,
        source: schema.kbDocuments.source,
        createdAt: schema.kbDocuments.createdAt,
        updatedAt: schema.kbDocuments.updatedAt,
      })
      .from(schema.kbDocuments)
      .where(eq(schema.kbDocuments.clinicId, clinicId))
      .orderBy(schema.kbDocuments.createdAt);
  }

  async create(clinicId: string, title: string, content: string, source = 'upload'): Promise<schema.KbDocument> {
    const [doc] = await db
      .insert(schema.kbDocuments)
      .values({ clinicId, title, content, source })
      .returning();
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
