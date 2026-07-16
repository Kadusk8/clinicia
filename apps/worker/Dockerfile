FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/evolution/package.json packages/evolution/
COPY packages/ai/package.json packages/ai/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @crm-clinicas/worker build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app /app
CMD ["pnpm", "--filter", "@crm-clinicas/worker", "start"]
