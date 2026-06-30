import { db, schema } from '@crm-clinicas/db';
import { and, eq } from 'drizzle-orm';
import type { ToolContext } from '../context.js';

export async function listarServicos(
  input: { categoria?: string },
  context: ToolContext,
): Promise<string> {
  const conditions = [
    eq(schema.services.clinicId, context.clinicId),
    eq(schema.services.active, true),
  ];

  if (input.categoria) {
    conditions.push(eq(schema.services.category, input.categoria));
  }

  const services = await db
    .select()
    .from(schema.services)
    .where(and(...conditions));

  if (services.length === 0) {
    return JSON.stringify({ services: [], message: 'Nenhum serviço encontrado.' });
  }

  return JSON.stringify({
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      acceptsInsurance: s.acceptsInsurance,
      insurancePlans: s.insurancePlans,
    })),
  });
}
