# GABI API — Cloud Run / Cloud Build
# https://turbo.build/repo/docs/guides/tools/docker

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2 prune @gabi/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/out/full/ .
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo build --filter=@gabi/api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 gabi
COPY --from=installer --chown=gabi:nodejs /app .
USER gabi
WORKDIR /app/apps/api
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
