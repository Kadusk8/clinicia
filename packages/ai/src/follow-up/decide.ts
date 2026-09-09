import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig } from '@crm-clinicas/shared';
import type { AgentMessage } from '../agent.js';
import { buildOpenAIClient } from '../classify.js';
import type { ClassifyKeys } from '../classify.js';

/**
 * Portão de decisão do follow-up de re-engajamento: roda imediatamente antes
 * de CADA um dos 7 toques da sequência (schedule.ts só grava os horários —
 * quem decide se manda e o que manda é este gate). Deliberadamente SEM
 * tools: o agente completo poderia agendar uma consulta sozinho num disparo
 * automático, o que é inaceitável sem o paciente ter pedido nada naquele
 * momento.
 *
 * O requisito do produto é "não incomodar quem não precisa" — por isso
 * qualquer falha (erro de API, JSON inválido, chave ausente) fecha pro lado
 * de NÃO enviar. Silêncio é sempre a opção segura aqui.
 */
export interface ReengagementDecision {
  enviar: boolean;
  encerrar: boolean;
  motivo: string;
  mensagem: string;
}

export interface DecideReengagementArgs {
  stepIndex: number; // 0-based
  totalSteps: number;
  stepLabel: string; // "20 minutos", "2 horas", "7 dias", ...
  clinicName: string;
  patientName: string | null;
  clinicConfig: AgentConfig;
  dynamicContext: string; // prompt da categoria + base de conhecimento, mesma montagem do agente principal
  conversationSummary: string | null;
  recentMessages: AgentMessage[];
  hoursSinceLastPatientMessage: number;
  nowLabel: string; // brasiliaLabel(new Date())
  keys: ClassifyKeys;
}

const FAIL_CLOSED: ReengagementDecision = { enviar: false, encerrar: false, motivo: 'erro_llm', mensagem: '' };

function buildPrompt(args: DecideReengagementArgs): string {
  const {
    stepIndex, totalSteps, stepLabel, clinicName, patientName,
    dynamicContext, conversationSummary, recentMessages,
    hoursSinceLastPatientMessage, nowLabel,
  } = args;

  const historico = [
    ...(conversationSummary ? [`[Resumo do início da conversa]\n${conversationSummary}`] : []),
    ...recentMessages.slice(-15).map((m) => `${m.role === 'user' ? 'Paciente' : 'Você'}: ${m.content}`),
  ].join('\n');

  return `Você é o mesmo atendente da *${clinicName}* que conduziu a conversa abaixo pelo WhatsApp${patientName ? ` com ${patientName}` : ''}.

${dynamicContext}

# Conversa até agora
${historico || '(sem mensagens anteriores)'}

# Situação agora
Agora é ${nowLabel}. A última mensagem do paciente foi há ${hoursSinceLastPatientMessage.toFixed(1)}h e ele não respondeu depois da sua última mensagem.
Esta é a tentativa ${stepIndex + 1} de ${totalSteps} de retomar contato (${stepLabel} depois da sua última mensagem).

# Sua decisão
O objetivo aqui é NÃO incomodar quem não precisa ser incomodado. Só decida enviar se houver uma
pendência real e concreta em aberto: uma pergunta sua que ficou sem resposta, um horário que você
ofereceu e ele não escolheu, um dado que faltou pra fechar o agendamento.

NÃO envie se: a conversa já se encerrou naturalmente (ele agradeceu, se despediu, só tirou uma
dúvida pontual e não demonstrou intenção de agendar); ele disse que ia pensar/decidir depois e
ainda é cedo pra cobrar; o assunto já foi resolvido; ou você já mandou algo parecido antes sem
resposta (não repita a mesma cobrança).

Se em algum ponto da conversa o paciente pediu explicitamente pra não receber mais mensagens
("para de mandar", "não quero mais", "me tira da lista"), responda enviar:false, encerrar:true,
com o motivo indicando o pedido de parada.

Quanto maior a tentativa, mais breve e menos insistente deve ser o tom. Nesta que é a tentativa
${stepIndex + 1} de ${totalSteps}${stepIndex === totalSteps - 1 ? ' (a ÚLTIMA)' : ''}${
    stepIndex === totalSteps - 1
      ? ', se for enviar, se despeça deixando a porta aberta (algo como "fico à disposição, é só chamar quando quiser") e marque encerrar:true.'
      : '.'
  }

Se decidir enviar, escreva a mensagem: continue de onde a conversa parou, no mesmo tom, no máximo
2 frases curtas, sem "Olá" genérico (vocês já estavam conversando), sem repetir literalmente o que
já foi dito. Separe por linha em branco se precisar de mais de um balão de WhatsApp.

Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"enviar": true ou false, "encerrar": true ou false, "motivo": "breve razão da decisão", "mensagem": "texto a enviar, ou vazio se enviar=false"}`;
}

function parseDecision(raw: string): ReengagementDecision {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const parsed = JSON.parse(cleaned) as Partial<ReengagementDecision>;
  if (typeof parsed.enviar !== 'boolean') throw new Error('campo "enviar" ausente/inválido');
  return {
    enviar: parsed.enviar,
    encerrar: typeof parsed.encerrar === 'boolean' ? parsed.encerrar : false,
    motivo: typeof parsed.motivo === 'string' ? parsed.motivo : '',
    mensagem: typeof parsed.mensagem === 'string' ? parsed.mensagem : '',
  };
}

async function callAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 400,
    temperature: 0.4,
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return textBlock?.text ?? '';
}

async function callOpenAICompatible(prompt: string, provider: string, apiKey: string, model: string): Promise<string> {
  const client = buildOpenAIClient(provider, apiKey);
  const response = await client.chat.completions.create({
    model,
    max_tokens: 400,
    temperature: 0.4,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message.content ?? '';
}

export async function decideReengagement(args: DecideReengagementArgs): Promise<ReengagementDecision> {
  const provider = args.clinicConfig.provider || 'anthropic';
  // Usa o MESMO modelo configurado pra clínica (não o barato do classify):
  // é texto que vai direto ao paciente carregando tom, regras de convênio e
  // limites clínicos da categoria — a qualidade do julgamento aqui é
  // exatamente o que decide se alguém é incomodado à toa ou não.
  const model = args.clinicConfig.model || 'claude-sonnet-4-5-20250514';
  const clinicKey = args.clinicConfig.apiKey?.trim();
  const fallback =
    provider === 'anthropic'
      ? args.keys.anthropicApiKey
      : provider === 'openai'
        ? args.keys.openaiApiKey
        : provider === 'google'
          ? args.keys.googleApiKey
          : provider === 'openrouter'
            ? args.keys.openrouterApiKey
            : undefined;
  const apiKey = clinicKey || fallback;
  if (!apiKey) return FAIL_CLOSED;

  const prompt = buildPrompt(args);

  try {
    const raw =
      provider === 'anthropic'
        ? await callAnthropic(prompt, apiKey, model)
        : await callOpenAICompatible(prompt, provider, apiKey, model);
    return parseDecision(raw);
  } catch {
    return FAIL_CLOSED;
  }
}
