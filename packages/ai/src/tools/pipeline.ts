import { db, schema } from '@crm-clinicas/db';
import { and, desc, eq } from 'drizzle-orm';

/**
 * O CRUD do pipeline (aba "Pipeline"/Kanban do CRM) sempre existiu, mas nada no
 * sistema criava um `deal` sozinho — nem quando um paciente conversava pela
 * primeira vez, nem quando agendava. A IA não deixava de preencher o funil por
 * falha dela: a ação não existia em lugar nenhum. Em vez de criar mais uma tool
 * pro modelo lembrar de chamar (frágil — o resto desta sessão foi cheio de
 * exemplos de passos que o modelo esquece), o funil é alimentado
 * automaticamente nos dois pontos naturais da conversa: identificação do
 * paciente (lead_novo) e agendamento confirmado (agendado).
 *
 * Os nomes de stage abaixo têm que bater exatamente com DEAL_STAGES
 * (packages/shared/src/types.ts) e com as chaves de STAGES no Kanban
 * (apps/web/.../pipeline/page.tsx) — um stage fora dessa lista não quebra
 * nada tecnicamente, só faz o deal desaparecer (não cai em nenhuma coluna).
 */

// Chamado quando um paciente é identificado/cadastrado numa conversa de
// WhatsApp. Cria um deal em "lead_novo" só se ainda não existir nenhum pra esse
// paciente — evita duplicar a cada nova conversa/atendimento do mesmo paciente.
export async function ensureLeadDeal(clinicId: string, patientId: string): Promise<void> {
  const [existing] = await db
    .select({ id: schema.deals.id })
    .from(schema.deals)
    .where(and(eq(schema.deals.clinicId, clinicId), eq(schema.deals.patientId, patientId)))
    .limit(1);

  if (existing) return;

  await db.insert(schema.deals).values({
    clinicId,
    patientId,
    stage: 'lead_novo',
  });
}

// Chamado quando um agendamento é confirmado. Avança o deal aberto mais
// recente do paciente pra "agendado" (sem regredir um deal que já esteja mais
// avançado, ex: já com presença confirmada); cria um deal novo em "agendado"
// se o paciente não tiver nenhum ainda (agendamento sem ter passado por
// cadastrar_paciente nesta conversa). Um deal em "faltou_remarcar" pode ser
// reaberto normalmente — é exatamente o caso de reagendar depois de faltar.
const STAGES_NOT_TO_REGRESS = new Set(['presenca_confirmada']);

export async function markDealScheduled(
  clinicId: string,
  patientId: string,
  serviceId: string,
  valueCents: number | null,
): Promise<void> {
  const [openDeal] = await db
    .select({ id: schema.deals.id, stage: schema.deals.stage })
    .from(schema.deals)
    .where(
      and(
        eq(schema.deals.clinicId, clinicId),
        eq(schema.deals.patientId, patientId),
      ),
    )
    .orderBy(desc(schema.deals.updatedAt))
    .limit(1);

  if (!openDeal) {
    await db.insert(schema.deals).values({
      clinicId,
      patientId,
      serviceId,
      stage: 'agendado',
      valueCents: valueCents ?? undefined,
    });
    return;
  }

  if (STAGES_NOT_TO_REGRESS.has(openDeal.stage)) return;

  await db
    .update(schema.deals)
    .set({ stage: 'agendado', serviceId, valueCents: valueCents ?? undefined, updatedAt: new Date() })
    .where(eq(schema.deals.id, openDeal.id));
}
