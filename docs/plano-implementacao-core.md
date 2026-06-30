# Plano de Implementação — Core do Produto (4 itens prioritários)

## Mapa de Dependências

```
Item 2 (Tool Handlers)
    │
    ├──> Item 4 (verificar_disponibilidade) [subtarefa do Item 2]
    │
    └──> Item 3 (Worker process_message)   [usa executeToolCall do Item 2]
              │
              └──> Item 1 (Webhook)        [enfileira jobs para o Item 3]
```

**Ordem de implementação: 2 → 4 → 3 → 1**

---

## Item 2 — Tool Handlers

### Arquivos a criar

**`packages/ai/src/tools/context.ts`** — tipo compartilhado entre todos os handlers:
```typescript
export interface ToolContext {
  clinicId: string;
  conversationId: string;
  patientPhone: string;
  clinicConfig: AgentConfig;
}
```

**`packages/ai/src/tools/handlers/buscar-paciente.ts`**
Query: `patients` com `and(eq(clinicId), eq(phone))`. Retorna JSON ou "não encontrado".

**`packages/ai/src/tools/handlers/cadastrar-paciente.ts`**
`db.insert(schema.patients)` com `lgpdConsent: true, lgpdConsentAt: new Date()`.
Usar `onConflictDoNothing` — se já existe, retorna o existente.

**`packages/ai/src/tools/handlers/listar-servicos.ts`**
Busca serviços ativos da clínica (`active: true`). Se `categoria` vier no input, adiciona filtro.

**`packages/ai/src/tools/handlers/verificar-disponibilidade.ts`**
Ver Item 4.

**`packages/ai/src/tools/handlers/agendar-consulta.ts`**
`db.insert(schema.appointments)` com `source: 'whatsapp_agent'`.
Após inserir: criar follow-ups `reminder_24h` (startsAt - 24h) e `reminder_2h` (startsAt - 2h) na tabela `followUps`.
⚠️ Usar `service.durationMin` (campo real do schema, não `durationMinutes`).

**`packages/ai/src/tools/handlers/cancelar-ou-remarcar.ts`**
- Cancelar: `status: 'cancelled', cancelledAt: new Date()`
- Remarcar: atualiza `startsAt/endsAt`, cancela follow-ups pendentes do appointment antigo

**`packages/ai/src/tools/handlers/registrar-anotacao-crm.ts`**
Append em `patients.notes` via select + update concatenando o texto com timestamp.

**`packages/ai/src/tools/handlers/transferir-humano.ts`**
`db.update(schema.conversations).set({ status: 'human_active' })`.

**`packages/ai/src/tools/handlers/consultar-base-conhecimento.ts`**
Chama `searchKnowledgeBase(clinicId, query)` de `rag.ts`. Se RAG não tiver embeddings ainda, retorna string vazia graciosamente (não quebra).

### Modificar: `packages/ai/src/tools/index.ts`
Adicionar e exportar `executeToolCall`:
```typescript
export async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext,
): Promise<string>
```
Switch sobre `name`, chamando cada handler. **Todo try/catch aqui** — nunca re-throw; retornar string de erro legível para o agente.

### Pontos de atenção
- **Multi-tenancy:** Todo handler DEVE incluir `clinicId` em TODOS os `.where()`. Nunca buscar só por `id`.
- **`workingHours` como jsonb:** Retorna `unknown` — criar interface `WorkingHours` e fazer cast tipado.
- **Retorno sempre `Promise<string>`:** Usar `JSON.stringify(result)` quando necessário.

---

## Item 4 — verificar_disponibilidade

**Arquivo:** `packages/ai/src/tools/handlers/verificar-disponibilidade.ts`

### Lógica interna (passo a passo)

**Passo 1 — Resolver profissionais:**
- Se `professionalId` vier no input: buscar validando `clinicId`.
- Se não vier: join `professionalServices` + `professionals` para obter todos que oferecem o `serviceId` naquela clínica.

**Passo 2 — Buscar appointments conflitantes no range:**
```typescript
db.select().from(schema.appointments).where(
  and(
    eq(schema.appointments.clinicId, clinicId),
    inArray(schema.appointments.professionalId, profIds),
    inArray(schema.appointments.status, ['scheduled', 'confirmed']),
    lt(schema.appointments.startsAt, toDate),
    gt(schema.appointments.endsAt, fromDate),
  )
)
```

**Passo 3 — Gerar slots por profissional:**
Para cada dia no range:
1. `dayOfWeek` via `Date.getDay()` → mapear para chave do JSON: `['sun','mon','tue','wed','thu','fri','sat']`
2. Se não existe entrada no `workingHours` para aquele dia: pular
3. Para cada intervalo `{start, end}`: gerar slots de `durationMin` minutos

**Passo 4 — Filtrar slots ocupados:**
Para cada slot `[slotStart, slotEnd]`: checar se existe appointment onde `apt.startsAt < slotEnd && apt.endsAt > slotStart`.

**Passo 5 — Retornar:**
Máximo 10 slots por profissional:
```typescript
{ professionalId, professionalName, slots: [{ startsAt: ISO, endsAt: ISO }] }
```

### Pontos de atenção
- **Timezone:** Definir convenção — usar UTC por padrão, ou `clinicConfig.timezone` se existir.
- **Range máximo:** Limitar `to - from` a 30 dias para evitar geração de milhares de slots.
- **`bufferMinutes` não existe no schema atual** — usar apenas `durationMin` como duração do slot.

---

## Item 3 — Worker process_message

**Arquivo:** `apps/worker/src/index.ts`

### Sequência dentro do job

1. Buscar conversa + clínica no DB
2. Buscar histórico: últimas 20 mensagens (`orderBy(desc(createdAt)).limit(20)`), reverter para ordem cronológica
3. Mapear roles: `'patient' | 'staff' | 'system'` → `'user'`; `'agent'` → `'assistant'`
4. Montar `AgentContext` (clinicConfig de `clinic.agentConfig`, dynamicContext vazio por ora)
5. Chamar agente:
```typescript
const agent = createAgent(process.env.ANTHROPIC_API_KEY!);
const result = await agent.processConversation(context, history, executeToolCall);
```
6. Persistir resposta: `role: 'agent'`, `toolCalls` em JSON
7. Atualizar `conversations.lastMessageAt`
8. Enviar via Evolution API: `evolutionClient.sendText(clinic.whatsappInstanceName, conv.externalId, result.response)`

### Pontos de atenção
- **`@crm-clinicas/ai` como dependência:** Verificar/adicionar no `package.json` do worker.
- **`ANTHROPIC_API_KEY` no .env do worker.**
- **Resposta vazia:** Se `result.response === ''` mas houve tool calls (ex: `transferir_humano`), não enviar mensagem — a tool já comunicou o resultado.

---

## Item 1 — Webhook (webhooks.service.ts)

**Arquivo principal:** `apps/api/src/webhooks/webhooks.service.ts`

### Completar os 3 TODOs

**TODO 1 — Find-or-create patient + conversa:**
```typescript
// Patient: buscar por clinicId + phone
// Se não existe: insert com lgpdConsent: false (consentimento via agente depois)
// Conversa: buscar por clinicId + externalId (phone)
// Se não existe: insert com status: 'agent_active'
```

**TODO 2 — Persistir mensagem:**
```typescript
await db.insert(schema.messages).values({
  conversationId: conversation[0].id,
  clinicId,
  role: 'patient',
  content,
  externalId: message.key.id,
});
// Atualizar lastMessageAt + unreadCount + 1 na conversa
```

**TODO 3 — Verificar status e enfileirar com debounce:**
```typescript
if (conversation[0].status !== 'agent_active') return;

await messageQueue.add('process',
  { conversationId: conversation[0].id, clinicId },
  {
    jobId: `msg-${conversation[0].id}`, // jobId fixo = debounce nativo do BullMQ
    delay: 8_000,
    removeOnComplete: 100,
    removeOnFail: 50,
  }
);
```

### Modificar: `apps/api/src/webhooks/webhooks.module.ts`
Adicionar provider para instanciar a Queue no processo da API:
```typescript
{
  provide: 'MESSAGE_QUEUE',
  useFactory: () => new Queue('process_message', {
    connection: new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null }),
  }),
}
```
Injetar com `@Inject('MESSAGE_QUEUE')` no `WebhooksService`.

### Pontos de atenção
- **Race condition no insert de patient:** Usar `onConflictDoNothing().returning()` e re-buscar se retornar vazio.
- **Mensagens de grupo:** Filtrar `if (remoteJid.endsWith('@g.us')) return;` logo no início.
- **`status !== 'agent_active'`:** Cobrir tanto `'human_active'` quanto `'closed'` com um único check.
- **`sql` import do Drizzle:** Para `unread_count + 1` usar `sql\`unread_count + 1\`` importado de `drizzle-orm`.

---

## Armadilhas Críticas

| Armadilha | Onde | Solução |
|---|---|---|
| `durationMin` vs `durationMinutes` | agendar, verificar | Usar `service.durationMin` (campo real) |
| Handler lançar exception | Todo handler | try/catch → retornar string de erro |
| `role: 'patient'` sem mapear para `'user'` | Worker | Map explícito antes de `processConversation` |
| Race condition no insert de patient | Webhook | `onConflictDoNothing` + re-select |
| Queue sem `maxRetriesPerRequest: null` | Webhook module | Obrigatório para BullMQ + ioredis |
| Mensagem de grupo (`@g.us`) | Webhook | Filtrar logo no início |
| `workingHours` como `unknown` | verificar-disponibilidade | Cast tipado com interface |
| `status: 'closed'` enfileirando job | Webhook | Checar `!== 'agent_active'`, não só `=== 'human_active'` |
| Resposta vazia após tool call | Worker | Não enviar se `response === ''` |

---

## Arquivos-chave resumidos

| Arquivo | Ação |
|---|---|
| `packages/ai/src/tools/context.ts` | Criar |
| `packages/ai/src/tools/handlers/*.ts` | Criar (9 handlers) |
| `packages/ai/src/tools/index.ts` | Modificar (adicionar `executeToolCall`) |
| `apps/worker/src/index.ts` | Modificar (implementar job `process_message`) |
| `apps/api/src/webhooks/webhooks.service.ts` | Modificar (3 TODOs) |
| `apps/api/src/webhooks/webhooks.module.ts` | Modificar (registrar Queue) |
