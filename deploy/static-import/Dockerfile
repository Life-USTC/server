FROM oven/bun:1.4.4-debian AS build
WORKDIR /app
COPY package.json bun.lock .bun-version ./
COPY patches ./patches
RUN bun install --frozen-lockfile
COPY . .
RUN DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_generate bun run app:prepare

FROM oven/bun:1.4.4-debian AS production-dependencies
WORKDIR /app
COPY package.json bun.lock .bun-version ./
COPY patches ./patches
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4-debian
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates curl gzip \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock .bun-version ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY . .
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/worker-configuration.d.ts ./worker-configuration.d.ts
RUN mkdir -p /data /cache && chown -R bun:bun /data /cache
ENV STATIC_IMPORT_QUEUE_DIR=/data \
    STATIC_SNAPSHOT_CACHE_DIR=/cache \
    STATIC_LOADER_DRY_RUN=false
USER bun
CMD ["python3", "deploy/static-import/worker.py"]
