import { buscarPaciente } from './handlers/buscar-paciente.js';
import { cadastrarPaciente } from './handlers/cadastrar-paciente.js';
import { listarServicos } from './handlers/listar-servicos.js';
import { verificarDisponibilidade } from './handlers/verificar-disponibilidade.js';
import { agendarConsulta } from './handlers/agendar-consulta.js';
import { cancelarOuRemarcar } from './handlers/cancelar-ou-remarcar.js';
import { registrarAnotacaoCrm } from './handlers/registrar-anotacao-crm.js';
import { transferirHumano } from './handlers/transferir-humano.js';
import { consultarBaseConhecimento } from './handlers/consultar-base-conhecimento.js';
import type { ToolContext } from './context.js';

export type { ToolContext };

export async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext,
): Promise<string> {
  try {
    switch (name) {
      case 'buscar_paciente':
        return await buscarPaciente(input as { phone: string }, context);
      case 'cadastrar_paciente':
        return await cadastrarPaciente(
          input as { phone: string; name: string; birthDate?: string; email?: string; insurance?: string },
          context,
        );
      case 'listar_servicos':
        return await listarServicos(input as { categoria?: string }, context);
      case 'verificar_disponibilidade':
        return await verificarDisponibilidade(
          input as { serviceId: string; professionalId?: string; from: string; to: string },
          context,
        );
      case 'agendar_consulta':
        return await agendarConsulta(
          input as { patientId: string; serviceId: string; professionalId: string; startsAt: string },
          context,
        );
      case 'cancelar_ou_remarcar':
        return await cancelarOuRemarcar(
          input as { appointmentId: string; action: 'cancel' | 'reschedule'; newStartsAt?: string; reason?: string },
          context,
        );
      case 'registrar_anotacao_crm':
        return await registrarAnotacaoCrm(
          input as { patientId: string; note: string; tags?: string[] },
          context,
        );
      case 'transferir_humano':
        return await transferirHumano(
          input as { motivo: string; urgencia: 'baixa' | 'media' | 'alta' },
          context,
        );
      case 'consultar_base_conhecimento':
        return await consultarBaseConhecimento(input as { query: string }, context);
      default:
        return JSON.stringify({ error: `Tool desconhecida: ${name}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: `Erro ao executar tool ${name}: ${message}` });
  }
}

// Agent tools definition for Anthropic function calling
export const agentTools = [
  {
    name: 'buscar_paciente',
    description: 'Busca paciente pelo telefone do WhatsApp.',
    input_schema: {
      type: 'object' as const,
      properties: {
        phone: { type: 'string' as const, description: 'Número de telefone do paciente' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'cadastrar_paciente',
    description: 'Cria novo paciente. Só chamar após consentimento LGPD explícito.',
    input_schema: {
      type: 'object' as const,
      properties: {
        phone: { type: 'string' as const },
        name: { type: 'string' as const },
        birthDate: { type: 'string' as const, description: 'YYYY-MM-DD' },
        email: { type: 'string' as const },
        insurance: { type: 'string' as const },
      },
      required: ['phone', 'name'],
    },
  },
  {
    name: 'listar_servicos',
    description: 'Lista serviços disponíveis da clínica. Filtra por categoria opcional.',
    input_schema: {
      type: 'object' as const,
      properties: {
        categoria: {
          type: 'string' as const,
          description: 'Filtrar por categoria (ex: consulta, exame, procedimento)',
        },
      },
    },
  },
  {
    name: 'verificar_disponibilidade',
    description: 'Retorna horários livres para um serviço num período.',
    input_schema: {
      type: 'object' as const,
      properties: {
        serviceId: { type: 'string' as const, description: 'UUID do serviço' },
        professionalId: { type: 'string' as const, description: 'UUID do profissional (opcional)' },
        from: { type: 'string' as const, description: 'Data/hora início (ISO datetime)' },
        to: { type: 'string' as const, description: 'Data/hora fim (ISO datetime)' },
      },
      required: ['serviceId', 'from', 'to'],
    },
  },
  {
    name: 'agendar_consulta',
    description: 'Cria agendamento. Só chamar após confirmação explícita do horário pelo paciente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        patientId: { type: 'string' as const, description: 'UUID do paciente' },
        serviceId: { type: 'string' as const, description: 'UUID do serviço' },
        professionalId: { type: 'string' as const, description: 'UUID do profissional' },
        startsAt: { type: 'string' as const, description: 'Data/hora início (ISO datetime)' },
      },
      required: ['patientId', 'serviceId', 'professionalId', 'startsAt'],
    },
  },
  {
    name: 'cancelar_ou_remarcar',
    description: 'Cancela ou remarca agendamento existente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointmentId: { type: 'string' as const, description: 'UUID do agendamento' },
        action: {
          type: 'string' as const,
          enum: ['cancel', 'reschedule'],
          description: 'Ação: cancelar ou remarcar',
        },
        newStartsAt: {
          type: 'string' as const,
          description: 'Nova data/hora (obrigatório se remarcar)',
        },
        reason: { type: 'string' as const, description: 'Motivo' },
      },
      required: ['appointmentId', 'action'],
    },
  },
  {
    name: 'registrar_anotacao_crm',
    description: 'Registra informação relevante no histórico do paciente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        patientId: { type: 'string' as const, description: 'UUID do paciente' },
        note: { type: 'string' as const, description: 'Anotação a registrar' },
        tags: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Tags de categorização',
        },
      },
      required: ['patientId', 'note'],
    },
  },
  {
    name: 'transferir_humano',
    description: 'Marca a conversa como needing-human e notifica a equipe.',
    input_schema: {
      type: 'object' as const,
      properties: {
        motivo: { type: 'string' as const, description: 'Motivo da transferência' },
        urgencia: {
          type: 'string' as const,
          enum: ['baixa', 'media', 'alta'],
          description: 'Nível de urgência',
        },
      },
      required: ['motivo', 'urgencia'],
    },
  },
  {
    name: 'consultar_base_conhecimento',
    description: 'Busca em FAQs e documentos da clínica. Use antes de inventar respostas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' as const, description: 'Pergunta para buscar na base' },
      },
      required: ['query'],
    },
  },
];
