// Memory management: sliding window + summary
import type { AgentMessage } from './agent.js';

const MAX_RECENT_MESSAGES = 20;
const SUMMARY_TRIGGER = 30;

export interface ConversationMemory {
  summary: string | null;
  recentMessages: AgentMessage[];
  totalTurns: number;
}

/**
 * Builds the message array for the agent, combining summary + recent messages.
 * If totalTurns > SUMMARY_TRIGGER, the summary should be regenerated.
 */
export function buildMessageWindow(memory: ConversationMemory): AgentMessage[] {
  const messages: AgentMessage[] = [];

  // If we have a summary, prepend it as a system-like user message
  if (memory.summary) {
    messages.push({
      role: 'user',
      content: `[Resumo do histórico anterior da conversa]\n${memory.summary}`,
    });
    messages.push({
      role: 'assistant',
      content: 'Entendi, tenho o contexto do histórico. Como posso ajudar agora?',
    });
  }

  // Add recent messages (last N turns)
  const recent = memory.recentMessages.slice(-MAX_RECENT_MESSAGES);
  messages.push(...recent);

  return messages;
}

/**
 * Checks if it's time to regenerate the summary.
 */
export function shouldRegenerateSummary(memory: ConversationMemory): boolean {
  return memory.totalTurns > 0 && memory.totalTurns % SUMMARY_TRIGGER === 0;
}

/**
 * Prompt for Haiku to generate a conversation summary.
 */
export function buildSummaryPrompt(messages: AgentMessage[]): string {
  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'Paciente' : 'Assistente'}: ${m.content}`)
    .join('\n');

  return `Resuma a conversa abaixo em no máximo 5 frases. 
Foque em: nome do paciente, motivo do contato, serviços discutidos, 
decisões tomadas (agendamentos feitos, cancelamentos, etc.), 
e qualquer informação pessoal relevante compartilhada.

Conversa:
${conversation}

Resumo:`;
}
