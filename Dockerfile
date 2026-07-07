FROM oven/bun:1.3.13 AS base
WORKDIR /usr/src/app

FROM base AS install-prod
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS loader
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=install-prod /usr/src/app/node_modules node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://localhost:5432/life_ustc" bun run db:generate
COPY src/static-loader ./src/static-loader
COPY scripts/load-static-sqlite.sh ./scripts/load-static-sqlite.sh
COPY docker-entrypoint.load.sh /usr/local/bin/docker-entrypoint.load.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.load.sh ./scripts/load-static-sqlite.sh

ENV NODE_ENV=production

ENTRYPOINT ["docker-entrypoint.load.sh"]
CMD ["scripts/load-static-sqlite.sh"]
