FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @crm-clinicas/web build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@crm-clinicas/web", "start"]
