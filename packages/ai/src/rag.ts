// RAG — Retrieval-Augmented Generation for clinic knowledge base
// Uses OpenAI text-embedding-3-small + pgvector for similarity search

import OpenAI from 'openai';
import { db, schema } from '@crm-clinicas/db';
import { eq, sql } from 'drizzle-orm';

export interface RagResult {
  content: string;
  score: number;
  documentTitle: string;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey });
}

/**
 * Generates a 1536-dim embedding vector using OpenAI text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191), // max tokens
    dimensions: 1536,
  });
  return response.data[0]!.embedding;
}

/**
 * Searches the knowledge base for relevant chunks using cosine similarity.
 */
export async function searchKnowledgeBase(
  clinicId: string,
  query: string,
  limit: number = 5,
): Promise<RagResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    // RAG not configured — return empty gracefully
    return [];
  }

  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch {
    return [];
  }

  const vectorStr = `[${embedding.join(',')}]`;

  // Use raw SQL for pgvector cosine distance operator <=>
  const rows = await db.execute(sql`
    SELECT
      kc.content,
      kd.title as document_title,
      1 - (kc.embedding <=> ${vectorStr}::vector) as score
    FROM kb_chunks kc
    JOIN kb_documents kd ON kd.id = kc.document_id
    WHERE kc.clinic_id = ${clinicId}::uuid
      AND kc.embedding IS NOT NULL
    ORDER BY kc.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return (rows as any[]).map((r: any) => ({
    content: r.content as string,
    documentTitle: r.document_title as string,
    score: Number(r.score),
  }));
}

/**
 * Splits text into overlapping chunks for embedding.
 * ~500 words per chunk, 50-word overlap.
 */
export function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const CHUNK_SIZE = 500;
  const OVERLAP = 50;
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (chunk.trim()) chunks.push(chunk);
    if (i + CHUNK_SIZE >= words.length) break;
  }

  return chunks.length > 0 ? chunks : [text];
}
