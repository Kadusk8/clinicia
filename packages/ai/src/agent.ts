import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { agentTools } from './tools/index.js';
import { buildSystemPrompt } from './prompts/system.js';
import type { AgentConfig } from '@crm-clinicas/shared';

// ==========================================
// Agent Context
// ==========================================

export interface AgentContext {
  clinicId: string;
  conversationId: string;
  patientPhone: string;
  clinicConfig: AgentConfig;
  clinicName: string;
  dynamicContext: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolHandler {
  (name: string, input: Record<string, unknown>, context: AgentContext): Promise<string>;
}

export interface AgentKeys {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  openrouterApiKey?: string;
}

type AgentResult = {
  response: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; result: string }>;
};

// ==========================================
// Tool format conversion
// ==========================================

function toOpenAITools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return agentTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// ==========================================
// Anthropic path (native SDK)
// ==========================================

async function processAnthropic(
  context: AgentContext,
  messageHistory: AgentMessage[],
  handleToolCall: ToolHandler,
  model: string,
  apiKey: string,
): Promise<AgentResult> {
  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(context);
  const collected: AgentResult['toolCalls'] = [];

  const messages: Anthropic.MessageParam[] = messageHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  let continueLoop = true;
  while (continueLoop) {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: agentTools as Anthropic.Tool[],
    });

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const tc of toolUseBlocks) {
        const result = await handleToolCall(
          tc.name,
          tc.input as Record<string, unknown>,
          context,
        );
        collected.push({ name: tc.name, input: tc.input as Record<string, unknown>, result });
        toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: result });
      }

      messages.push({ role: 'user', content: toolResults });
    } else {
      continueLoop = false;
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      return { response: textBlock?.text ?? '', toolCalls: collected };
    }
  }

  return { response: '', toolCalls: collected };
}

// ==========================================
// OpenAI-compatible path (OpenAI, Google, OpenRouter)
// ==========================================

function buildOpenAIClient(provider: string, apiKey: string): OpenAI {
  switch (provider) {
    case 'openai':
      return new OpenAI({ apiKey });
    case 'google':
      return new OpenAI({
        apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
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

async function processOpenAICompatible(
  context: AgentContext,
  messageHistory: AgentMessage[],
  handleToolCall: ToolHandler,
  model: string,
  provider: string,
  apiKey: string,
): Promise<AgentResult> {
  const client = buildOpenAIClient(provider, apiKey);
  const systemPrompt = buildSystemPrompt(context);
  const collected: AgentResult['toolCalls'] = [];
  const openAITools = toOpenAITools();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messageHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  let continueLoop = true;
  while (continueLoop) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: openAITools,
      tool_choice: 'auto',
      max_tokens: 1024,
    });

    const choice = response.choices[0]!;

    if (choice.finish_reason === 'tool_calls') {
      const assistantMsg = choice.message;
      messages.push(assistantMsg);

      const toolCallMsgs: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

      for (const tc of assistantMsg.tool_calls ?? []) {
        const input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        const result = await handleToolCall(tc.function.name, input, context);
        collected.push({ name: tc.function.name, input, result });
        toolCallMsgs.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      messages.push(...toolCallMsgs);
    } else {
      continueLoop = false;
      return { response: choice.message.content ?? '', toolCalls: collected };
    }
  }

  return { response: '', toolCalls: collected };
}

// ==========================================
// Agent Factory
// ==========================================

export function createAgent(keys: AgentKeys) {
  async function processConversation(
    context: AgentContext,
    messageHistory: AgentMessage[],
    handleToolCall: ToolHandler,
  ): Promise<AgentResult> {
    const provider = context.clinicConfig.provider || 'anthropic';
    const model = context.clinicConfig.model || 'claude-sonnet-4-5-20250514';

    // Per-clinic API key takes precedence; env keys are only a fallback.
    const clinicKey = context.clinicConfig.apiKey?.trim();

    if (provider === 'anthropic') {
      const apiKey = clinicKey || keys.anthropicApiKey;
      if (!apiKey) throw new Error('API key da Anthropic não configurada para esta clínica');
      return processAnthropic(context, messageHistory, handleToolCall, model, apiKey);
    }

    const fallback =
      provider === 'openai'
        ? keys.openaiApiKey
        : provider === 'google'
          ? keys.googleApiKey
          : provider === 'openrouter'
            ? keys.openrouterApiKey
            : undefined;
    const apiKey = clinicKey || fallback;
    if (!apiKey) throw new Error(`API key do provedor "${provider}" não configurada para esta clínica`);

    return processOpenAICompatible(context, messageHistory, handleToolCall, model, provider, apiKey);
  }

  return { processConversation };
}
