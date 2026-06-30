# Plano de Implementação: Features Restantes

**Status do plano:** gerado automaticamente — atualizar conforme progresso.

## Status por Item

| # | Item | Status |
|---|---|---|
| 1 | Inbox funcional | ✅ Implementado |
| 2 | Dashboard com dados reais | ✅ Implementado |
| 3 | Agenda funcional | ✅ Implementado |
| 4 | Settings conectada à API | ✅ Implementado |
| 5 | Working Hours UI (profissionais) | 🔲 Pendente |
| 6 | Pipeline Kanban com dados reais | ✅ Implementado |
| 7 | Reports/Analytics module | 🔲 Pendente |
| 8 | RAG Embeddings | 🔲 Pendente |
| 9 | SaaS Layer | 🔲 Pendente |

---

## Item 5 — Working Hours UI (Profissionais)

**Complexidade: Simples**

### Backend
Arquivo a modificar: `apps/api/src/professionals/professionals.controller.ts`
- Adicionar endpoint `PATCH /professionals/:id/working-hours` que chama `update(clinicId, id, { workingHours: body.workingHours })`.
- Schema Zod `updateProfessionalSchema` já aceita `workingHours` via `.partial()`.

### Frontend
- Conectar `apps/web/src/app/(dashboard)/professionals/page.tsx` à API.
- Criar `apps/web/src/components/professionals/WorkingHoursModal.tsx`:
  - Array fixo dos 7 dias da semana (`['mon','tue','wed','thu','fri','sat','sun']`).
  - Para cada dia: checkbox "Ativo" + inputs time "Início" e "Fim".
  - Submit chama `PATCH /professionals/:id/working-hours`.

---

## Item 7 — Reports/Analytics

**Complexidade: Média**

### Backend (adicionar ao módulo Reports existente)
Endpoints adicionais:
- `GET /reports/appointments?from=&to=`: agrupamento por status, soma de receita via join com services.
- `GET /reports/conversations`: proporção que gerou agendamento.
- `GET /reports/appointments/export`: CSV com `Content-Disposition: attachment`.

### Frontend
- Criar `apps/web/src/app/(dashboard)/reports/page.tsx`.
- Date range picker + tabelas de dados.
- Botão "Exportar CSV".
- Adicionar link "Relatórios" na sidebar.

---

## Item 8 — RAG Embeddings

**Complexidade: Complexa**

### Dependências
- `CREATE EXTENSION IF NOT EXISTS vector;` no PostgreSQL.
- `OPENAI_API_KEY` nas env vars do worker (Anthropic não tem API de embedding).

### Sequência
1. Implementar `generateEmbedding(text)` em `packages/ai/src/rag.ts` — usar OpenAI `text-embedding-3-small` (1536 dims).
2. Implementar `searchKnowledgeBase(clinicId, query, limit)` em `rag.ts` — cosine distance com pgvector `<=>`.
3. Completar `embeddingWorker` em `apps/worker/src/index.ts`: chunkar conteúdo (~500 palavras, overlap 50), gerar embedding por chunk, inserir em `kbChunks`.
4. Criar módulo `knowledge-base` no backend:
   - `GET /knowledge-base`: listar documentos.
   - `POST /knowledge-base/upload`: salvar, enfileirar job de embedding.
   - `DELETE /knowledge-base/:id`: deletar documento + chunks.
5. UI na aba "Base de Conhecimento" em Settings.

---

## Item 9 — SaaS Layer

**Complexidade: Complexa**

### 9a. Onboarding
- Criar `apps/web/src/app/(onboarding)/onboarding/page.tsx` — fluxo multi-step.
- Step 1: dados da clínica. Step 2: QR WhatsApp com polling. Step 3: cadastro de serviços.

### 9b. Landing Page
- Criar `apps/web/src/app/page.tsx` (raiz pública) — Hero, Features, Preços, CTA.

### 9c. Integração Asaas
- Criar módulo `billing` no backend.
- `POST /billing/webhook`: eventos `PAYMENT_RECEIVED` e `PAYMENT_OVERDUE`.
- Modificar `TenantGuard` para verificar `clinic.active === true`.

---

## Arquivos-chave para referência

- Schema DB: `packages/db/src/schema/`
- Tools do agente: `packages/ai/src/tools/`
- RAG: `packages/ai/src/rag.ts`
- Workers: `apps/worker/src/index.ts`
- API client: `apps/web/src/lib/api.ts`
- App module: `apps/api/src/app.module.ts`
