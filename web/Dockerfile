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
COPY web web
ENV STANDALONE=1
RUN pnpm --filter @anima/shared build && pnpm --filter @anima/web build

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /repo/web/.next/standalone ./
COPY --from=build /repo/web/.next/static ./web/.next/static
COPY --from=build /repo/web/public ./web/public
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]
