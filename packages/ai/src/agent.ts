import Anthropic from '@anthropic-ai/sdk';
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
  dynamicContext: string; // RAG results, business info, etc.
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolHandler {
  (name: string, input: Record<string, unknown>, context: AgentContext): Promise<string>;
}

// ==========================================
// Agent Factory
// ==========================================

export function createAgent(apiKey: string) {
  const client = new Anthropic({ apiKey });

  async function processConversation(
    context: AgentContext,
    messageHistory: AgentMessage[],
    handleToolCall: ToolHandler,
  ): Promise<{
    response: string;
    toolCalls: Array<{ name: string; input: Record<string, unknown>; result: string }>;
  }> {
    const systemPrompt = buildSystemPrompt(context);
    const toolCalls: Array<{ name: string; input: Record<string, unknown>; result: string }> = [];

    // Build messages array for Anthropic
    const messages: Anthropic.MessageParam[] = messageHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    let continueLoop = true;

    while (continueLoop) {
      const response = await client.messages.create({
        model: context.clinicConfig.model || 'claude-sonnet-4-5-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: agentTools as Anthropic.Tool[],
      });

      // Check if response has tool use
      if (response.stop_reason === 'tool_use') {
        // Find tool use blocks
        const assistantContent = response.content;
        messages.push({ role: 'assistant', content: assistantContent });

        const toolUseBlocks = assistantContent.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const result = await handleToolCall(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            context,
          );

          toolCalls.push({
            name: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            result,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        messages.push({ role: 'user', content: toolResults });
      } else {
        // Final text response
        continueLoop = false;
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
        return {
          response: textBlock?.text ?? '',
          toolCalls,
        };
      }
    }

    return { response: '', toolCalls };
  }

  return { processConversation };
}
