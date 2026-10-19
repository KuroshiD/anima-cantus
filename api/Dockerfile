FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY shared/package.json shared/package.json
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile
COPY shared shared
COPY api api
RUN pnpm --filter @anima/shared build \
  && pnpm --filter @anima/api exec prisma generate \
  && pnpm --filter @anima/api build

FROM base AS migrate
COPY --from=build /repo /repo
WORKDIR /repo/api
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runtime
COPY --from=build /repo /repo
WORKDIR /repo/api
ENV NODE_ENV=production
USER node
CMD ["node", "dist/main.js"]
