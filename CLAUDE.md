# CRM + Agente IA WhatsApp para Clínicas

## Stack & Versões

- **Runtime**: Node.js 20+ / TypeScript 5.7 (strict mode)
- **Backend**: NestJS 11 + Fastify
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- **ORM**: Drizzle ORM
- **DB**: PostgreSQL 16 + pgvector
- **Fila**: BullMQ + Redis
- **Auth**: Better Auth (multi-tenant)
- **LLM**: Claude Sonnet 4.5 (agente) + Haiku 4.5 (tarefas baratas)
- **WhatsApp**: Evolution API self-hosted
- **Pagamentos**: Asaas
- **Monorepo**: pnpm workspaces

## Estrutura

```
crm-clinicas/
├── apps/api/        # NestJS backend
├── apps/web/        # Next.js CRM frontend
├── apps/worker/     # BullMQ workers
├── packages/db/     # Drizzle schema + migrations
├── packages/ai/     # Agente IA + tools + RAG
├── packages/evolution/  # Cliente da Evolution API
├── packages/shared/ # Tipos, validators, errors
└── packages/ui/     # shadcn components compartilhados
```

## Convenções de Código

### Naming
- **TypeScript**: camelCase para variáveis/funções, PascalCase para tipos/classes
- **Banco de dados**: snake_case para colunas e tabelas
- **Arquivos**: kebab-case (ex: `patient-service.ts`)
- **Módulos NestJS**: PascalCase (ex: `PatientsModule`)

### Multi-tenancy
- **SEMPRE** passe `clinicId` explicitamente em queries — nunca confie em escopo global
- Toda tabela com dados de tenant tem coluna `clinic_id`
- RLS habilitado em todas as tabelas com dados de tenant
- `TenantGuard` injeta `clinicId` via `SET LOCAL app.current_clinic_id`

### Validação
- **Zod** em todo input externo (request bodies, query params, webhook payloads)
- Validators definidos em `packages/shared/src/validators.ts`

### Tratamento de Erros
- Use classes de erro customizadas (em `packages/shared/src/errors.ts`)
- Pattern `Result<T, E>` para operações que podem falhar previsivelmente
- Erros inesperados: throw com classe de erro específica

### IA / Agente
- System prompt parametrizado em `packages/ai/src/prompts/system.ts`
- Tools definidas em `packages/ai/src/tools/`
- Memória: últimos 20 turns + summary gerado por Haiku a cada 30 turns
- NUNCA deixar o agente diagnosticar ou prescrever

## Como Rodar

```bash
# Instalar dependências
pnpm install

# Subir infraestrutura local
docker compose up -d

# Copiar variáveis de ambiente
cp .env.example .env

# Gerar migrations do Drizzle
pnpm db:generate

# Aplicar migrations
pnpm db:migrate

# Dev (tudo junto)
pnpm dev

# Dev individual
pnpm dev:api    # NestJS na porta 3001
pnpm dev:web    # Next.js na porta 3000
pnpm dev:worker # BullMQ workers
```

## Arquivos Importantes

- Schema do banco: `packages/db/src/schema/`
- Tools do agente: `packages/ai/src/tools/`
- System prompt: `packages/ai/src/prompts/system.ts`
- Validators: `packages/shared/src/validators.ts`
- Cliente Evolution: `packages/evolution/src/client.ts`
