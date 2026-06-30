import { searchKnowledgeBase } from '../../rag.js';
import type { ToolContext } from '../context.js';

export async function consultarBaseConhecimento(
  input: { query: string },
  context: ToolContext,
): Promise<string> {
  const results = await searchKnowledgeBase(context.clinicId, input.query, 5);

  if (results.length === 0) {
    return JSON.stringify({
      found: false,
      message: 'Nenhuma informação encontrada na base de conhecimento.',
    });
  }

  const content = results
    .map((r) => `[${r.documentTitle}]\n${r.content}`)
    .join('\n\n---\n\n');

  return JSON.stringify({ found: true, content });
}
