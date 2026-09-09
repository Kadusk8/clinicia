import type { EvolutionClient } from './client.js';

/**
 * O modelo respondia com o texto inteiro (às vezes vários parágrafos) numa
 * única mensagem de WhatsApp — lido como um bloco de texto grande, nada
 * parecido com a forma como uma pessoa realmente conversa por lá. Quebra a
 * resposta em balões menores nas quebras de parágrafo (linha em branco), e
 * quando mesmo assim um parágrafo sozinho passa do limite de caracteres de um
 * balão (o modelo nem sempre respeita "mensagens curtas" do prompt — pedir
 * não é garantir), quebra também por frase. Cada balão final vira um envio
 * separado, com uma pequena pausa entre eles pra simular alguém digitando.
 */
const MAX_BUBBLE_CHARS = 220;

export function splitIntoWhatsAppMessages(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.flatMap((paragraph) =>
    paragraph.length <= MAX_BUBBLE_CHARS ? [paragraph] : splitBySentence(paragraph),
  );
}

function splitBySentence(paragraph: string): string[] {
  // Mantém pontuação final ao separar (. ! ?) — sem isso a frase perde o ponto.
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [paragraph];
  const bubbles: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current && current.length + 1 + sentence.length > MAX_BUBBLE_CHARS) {
      bubbles.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) bubbles.push(current);
  return bubbles;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tempo de "digitando..." proporcional ao tamanho do balão, pra parecer
// alguém escrevendo de verdade em vez de um robô respondendo instantâneo.
export function typingDelayFor(text: string): number {
  return Math.min(3000, Math.max(900, 700 + text.length * 12));
}

/**
 * Manda um texto pro WhatsApp quebrado em balões humanizados: cada balão
 * dispara "digitando..." (via EvolutionClient.sendPresence), espera um tempo
 * proporcional ao tamanho do texto, e só então envia. Usado tanto pela
 * resposta normal do agente quanto pelo follow-up de re-engajamento — os
 * dois têm que "soar" da mesma pessoa.
 */
export async function sendHumanizedText(
  client: EvolutionClient,
  params: { number: string; text: string },
): Promise<number> {
  const bubbles = splitIntoWhatsAppMessages(params.text);
  for (const bubble of bubbles) {
    const typingMs = typingDelayFor(bubble);
    // "digitando..." é cosmético — se a Evolution Go rejeitar essa chamada,
    // a mensagem real ainda tem que sair.
    try {
      await client.sendPresence({ number: params.number, state: 'composing', delay: typingMs });
    } catch (e) {
      console.error('Falha ao enviar indicador de "digitando" (ignorado):', (e as Error).message);
    }
    await sleep(typingMs);
    await client.sendText({ number: params.number, text: bubble });
  }
  return bubbles.length;
}
