// Classificação de categoria — chamada isolada e barata (Haiku), fora do loop
// de tools do agente principal. Usada só quando clinics.agent_mode = 'multi'.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { AgentConfig } from '@crm-clinicas/shared';
import type { AgentMessage } from './agent.js';

export interface CategoryOption {
  key: string;
  label: string;
}

export interface ClassifyKeys {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  openrouterApiKey?: string;
}

const CHEAP_MODEL_BY_PROVIDER: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  google: 'gemini-1.5-flash',
  openrouter: 'anthropic/claude-haiku-4-5',
};

function buildClassificationPrompt(categories: CategoryOption[], recentMessages: AgentMessage[]): string {
  const categoriesList = categories.map((c) => `- ${c.key}: ${c.label}`).join('\n');
  const conversation = recentMessages
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Paciente' : 'Assistente'}: ${m.content}`)
    .join('\n');

  return `Classifique o assunto da conversa abaixo em uma destas categorias:
${categoriesList}

Conversa:
${conversation}

Responda APENAS com a "key" da categoria mais provável, exatamente como escrita acima, sem mais nada.
Se nenhuma categoria fizer sentido pra essa conversa, responda "nenhuma".`;
}

function extractCategoryKey(rawResponse: string, categories: CategoryOption[]): string | null {
  const normalized = rawResponse.trim().toLowerCase();
  const match = categories.find((c) => c.key.toLowerCase() === normalized);
  return match?.key ?? null;
}

async function classifyWithAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 20,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return textBlock?.text ?? '';
}

export function buildOpenAIClient(provider: string, apiKey: string): OpenAI {
  switch (provider) {
    case 'openai':
      return new OpenAI({ apiKey });
    case 'google':
      return new OpenAI({ apiKey, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
    case 'openrouter':
      return new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://clinicia.app', 'X-Title': 'ClinicIA' },
      });
    default:
      throw new Error(`Provedor desconhecido: ${provider}`);
  }
}

async function classifyWithOpenAICompatible(
  prompt: string,
  provider: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const client = buildOpenAIClient(provider, apiKey);
  const response = await client.chat.completions.create({
    model,
    max_tokens: 20,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message.content ?? '';
}

/**
 * Classifica a mensagem/histórico recente numa das categorias ativas da clínica.
 * Retorna a key da categoria, ou null se não conseguir classificar com confiança
 * (mensagem ambígua, resposta fora da lista, ou erro na chamada).
 */
export async function classifyCategory(
  categories: CategoryOption[],
  recentMessages: AgentMessage[],
  clinicConfig: AgentConfig,
  keys: ClassifyKeys,
): Promise<string | null> {
  if (categories.length === 0) return null;

  const provider = clinicConfig.provider || 'anthropic';
  const model = CHEAP_MODEL_BY_PROVIDER[provider] ?? CHEAP_MODEL_BY_PROVIDER.anthropic!;
  const clinicKey = clinicConfig.apiKey?.trim();
  const fallback =
    provider === 'anthropic'
      ? keys.anthropicApiKey
      : provider === 'openai'
        ? keys.openaiApiKey
        : provider === 'google'
          ? keys.googleApiKey
          : provider === 'openrouter'
            ? keys.openrouterApiKey
            : undefined;
  const apiKey = clinicKey || fallback;
  if (!apiKey) return null;

  const prompt = buildClassificationPrompt(categories, recentMessages);

  try {
    const raw =
      provider === 'anthropic'
        ? await classifyWithAnthropic(prompt, apiKey, model)
        : await classifyWithOpenAICompatible(prompt, provider, apiKey, model);
    return extractCategoryKey(raw, categories);
  } catch {
    return null;
  }
}
