import type { AgentConfig } from '@crm-clinicas/shared';

export interface ToolContext {
  clinicId: string;
  conversationId: string;
  patientPhone: string;
  clinicConfig: AgentConfig;
  // Categoria resolvida da conversa (modo multi-agente). Null em modo single
  // ou quando a mensagem ainda não foi classificada em nenhuma categoria.
  categoryKey?: string | null;
}
