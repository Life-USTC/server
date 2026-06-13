FROM oven/bun:1.3.13 AS base
WORKDIR /usr/src/app

FROM base AS install-dev
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS install-prod
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS builder
COPY --from=install-dev /usr/src/app/node_modules node_modules
COPY . .

ENV DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_generate

RUN bun run svelte-kit sync \
  && bun run prisma generate \
  && bun build tools/load/load-from-static.ts \
    --target=bun \
    --outdir=dist/tools/load \
    --external '@prisma/*' \
    --external pg

FROM base AS loader
COPY --from=install-prod /usr/src/app/node_modules node_modules
COPY --from=builder /usr/src/app/dist/tools/load dist/tools/load
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
COPY docker-entrypoint.load.sh /usr/local/bin/docker-entrypoint.load.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.load.sh

ENV NODE_ENV=production

ENTRYPOINT ["docker-entrypoint.load.sh"]
