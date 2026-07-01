# Plano de Implementação — CRM ClinicIA

## Status Atual

O projeto tem ~70% implementado. Backend, agente IA, workers e webhooks estão bem estruturados.
O que falta são: pgvector no schema, knowledge-base triggering embeddings, frontend real, e pequenos gaps.

---

## Bugs Corrigidos ✅

- `conversations.service.ts`: removido `evolutionClient` global, agora usa credenciais da clínica
- `worker/index.ts` (messageWorker): idem
- `worker/index.ts` (followUpWorker): idem

---

## FASE 1 — Banco de Dados (pgvector) 🔴 Crítico

### 1.1 Habilitar pgvector no schema
**Arquivo**: `packages/db/src/schema/knowledge-base.ts`

O campo `embedding` precisa usar o tipo `vector(1536)` do pgvector, não um campo genérico.

```ts
// Adicionar no topo do schema:
import { customType } from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'vector(1536)'; },
  toDriver(value) { return `[${value.join(',')}]`; },
  fromDriver(value) { return JSON.parse(value.replace(/\[|\]/g, '').split(',').map(Number)); },
});
```

**Migração necessária**: `pnpm db:generate && pnpm db:migrate`

Também adicionar extensão no init:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.2 Adicionar script de init do pgvector
**Arquivo**: `packages/db/src/migrate.ts` (ou similar)

Garantir que `CREATE EXTENSION IF NOT EXISTS vector;` rode antes das migrations.

---

## FASE 2 — Knowledge Base (trigger embeddings) 🔴 Crítico

### 2.1 Conectar knowledge-base.service.ts ao embeddingQueue
**Arquivo**: `apps/api/src/knowledge-base/knowledge-base.service.ts`

Ao criar um documento, enfileirar o job de embedding:

```ts
async create(clinicId: string, title: string, content: string, source = 'upload') {
  const [doc] = await db.insert(schema.kbDocuments).values(...).returning();

  // Enfileirar geração de embeddings
  await embeddingQueue.add('process', { documentId: doc.id, clinicId });

  return doc;
}
```

**Problema**: o `embeddingQueue` está no worker, não na API. Solução: exportar a Queue separada em `packages/shared` ou criar um módulo BullMQ no NestJS.

**Abordagem recomendada**: Criar `apps/api/src/queues/queues.module.ts` com BullMQ provider.

### 2.2 Trocar OpenAI por Claude para embeddings (ou manter OpenAI)
**Arquivo**: `packages/ai/src/rag.ts`

Atualmente usa `openai/text-embedding-3-small`. Claude não tem API de embeddings.
**Decisão**: manter OpenAI para embeddings (é o padrão do mercado para pgvector), ou usar `@xenova/transformers` local.

---

## FASE 3 — Appointments → Follow-ups automático 🟡 Importante

### 3.1 Conectar appointments.service ao follow-ups.service
**Arquivo**: `apps/api/src/appointments/appointments.service.ts`

Ao criar um agendamento, auto-criar os follow-ups (24h antes, 2h antes, pós-visita):

```ts
async create(clinicId: string, data: CreateAppointmentDto) {
  const [appointment] = await db.insert(schema.appointments).values(...).returning();

  // Auto-criar follow-ups
  await this.followUpsService.createForAppointment(
    clinicId,
    appointment.id,
    appointment.patientId,
    appointment.startsAt,
  );

  return appointment;
}
```

Verificar se `AppointmentsModule` importa `FollowUpsModule`.

### 3.2 Cancelar follow-ups ao cancelar agendamento
Já existe `followUpsService.cancelForAppointment(appointmentId)` — só precisa ser chamado no cancel.

---

## FASE 4 — Frontend Real 🟡 Importante

Todas as páginas existem mas são scaffolds. Implementar na ordem de prioridade:

### 4.1 `/inbox` — Caixa de entrada WhatsApp
**Arquivo**: `apps/web/src/app/(dashboard)/inbox/page.tsx`

- Lista de conversas (GET `/api/conversations`)
- Janela de chat com histórico de mensagens
- Botão "Assumir / Devolver ao agente"
- Input para enviar mensagem como staff
- WebSocket ou polling para mensagens em tempo real

### 4.2 `/patients` — Gestão de pacientes
- Tabela paginada com busca
- Modal de criação/edição
- Ver histórico de agendamentos do paciente

### 4.3 `/agenda` — Agenda
- Calendário (react-big-calendar ou similar)
- Modal para criar agendamento
- Integrado com `professionals` e `services`

### 4.4 `/dashboard` — Métricas
- Cards: total pacientes, agendamentos hoje, conversas ativas
- Gráfico de agendamentos por período

### 4.5 `/pipeline` — Kanban de deals
- Board kanban (arrastar entre colunas)
- Colunas: Novo Lead → Contato → Agendado → Compareceu → Perdido

### 4.6 `/settings` — Configurações da clínica
- Formulário: nome, telefone, horários de funcionamento
- Config do agente IA (nome, tom, saudação)
- Status de conexão WhatsApp

### 4.7 `/services` e `/professionals`
- CRUDs simples com tabelas + modais

---

## FASE 5 — API: Endpoints faltantes 🟡 Importante

### 5.1 Reports
**Arquivo**: `apps/api/src/reports/reports.service.ts`

Verificar se está retornando dados reais ou mock. Implementar:
- Agendamentos por período
- Taxa de no-show
- Conversas por dia
- Top serviços

### 5.2 Pipeline (Deals)
**Arquivo**: `apps/api/src/pipeline/pipeline.service.ts`

- CRUD de deals com stage
- Mover deal entre stages

### 5.3 Webhook Asaas
**Arquivo**: `apps/api/src/billing/billing.controller.ts`

Verificar se o endpoint de webhook do Asaas está registrado e autenticado com `x-asaas-signature`.

---

## FASE 6 — Infraestrutura & Deploy 🟢 Complementar

### 6.1 Variáveis de ambiente `.env.example` completo
Criar `.env.example` com todas as variáveis necessárias:
```
DATABASE_URL=
REDIS_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=        # para embeddings RAG
ASAAS_API_KEY=
ASAAS_ENVIRONMENT=sandbox
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=
```

### 6.2 Docker Compose completo
Adicionar PostgreSQL com pgvector ao `docker-compose.yml`:
```yaml
postgres:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_DB: crm_clinicas
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  ports:
    - '5432:5432'
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

### 6.3 Real-time no Inbox (WebSocket ou SSE)
Para o inbox mostrar mensagens em tempo real sem polling:
- **Opção A**: Server-Sent Events (SSE) no NestJS — mais simples
- **Opção B**: Socket.IO — mais robusto, já suportado pelo Fastify

---

## Ordem de Execução Recomendada

| Prioridade | Fase | Estimativa |
|-----------|------|-----------|
| 1 | 1.1 + 1.2 — pgvector no schema + docker | Baixa complexidade |
| 2 | 2.1 — Knowledge base → trigger embeddings | Média complexidade |
| 3 | 3.1 + 3.2 — Appointments → follow-ups | Baixa complexidade |
| 4 | 4.1 — Inbox frontend | Alta complexidade |
| 5 | 4.2 + 4.3 — Patients + Agenda | Alta complexidade |
| 6 | 5.x — API reports/pipeline/billing | Média complexidade |
| 7 | 4.4-4.7 — Demais páginas frontend | Média complexidade |
| 8 | 6.x — Real-time + deploy | Alta complexidade |
