import type { AgentConfig } from '@crm-clinicas/shared';

export interface ToolContext {
  clinicId: string;
  conversationId: string;
  patientPhone: string;
  clinicConfig: AgentConfig;
}
