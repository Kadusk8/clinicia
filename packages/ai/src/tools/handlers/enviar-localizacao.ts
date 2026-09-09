import { db, schema } from '@crm-clinicas/db';
import { eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

interface ClinicLocation {
  key: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Envio de localização é uma mensagem nativa do WhatsApp (pin de mapa), não
 * texto — não dá pra "escrever" isso na resposta do modelo. A tool só
 * resolve e valida o local; quem efetivamente dispara o pin é o worker,
 * depois que o turno termina, lendo esse resultado em result.toolCalls
 * (mesmo padrão de reidratação já usado pra outras tools).
 */
export async function enviarLocalizacao(
  input: { local: string },
  context: ToolContext,
): Promise<string> {
  const [clinic] = await db
    .select({ locations: schema.clinics.locations })
    .from(schema.clinics)
    .where(eq(schema.clinics.id, context.clinicId))
    .limit(1);

  const locations = (clinic?.locations as ClinicLocation[] | undefined) ?? [];

  if (locations.length === 0) {
    return JSON.stringify({
      success: false,
      error: 'Nenhuma localização cadastrada pra essa clínica ainda.',
    });
  }

  const found = locations.find(
    (l) => l.key === input.local || l.label.toLowerCase() === input.local.toLowerCase(),
  );

  if (!found) {
    return JSON.stringify({
      success: false,
      error: `Local "${input.local}" não encontrado. Locais disponíveis: ${locations.map((l) => l.key).join(', ')}.`,
    });
  }

  return JSON.stringify({
    success: true,
    location: found,
  });
}
