# Build stage
# Use the repo-pinned Bun release for consistent local/CI/runtime behavior.
FROM oven/bun:1.3.13 AS base
WORKDIR /usr/src/app

# Install build dependencies in a temp dir for caching
FROM base AS install-dev
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies separately for the runtime image
FROM base AS install-prod
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Builder: bring dev node_modules and project files, then build
FROM base AS builder

COPY --from=install-dev /temp/dev/node_modules node_modules
COPY . .

ENV NODE_ENV=production
ENV APP_PHASE=phase-production-build
ENV DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_build

RUN bun run build \
 && bun build tools/production/load/load-from-static.ts \
      --target=bun \
      --outdir=dist/tools/production/load \
      --external '@prisma/*' \
      --external pg

# Collect all runtime files into a single staging directory
RUN mkdir -p /output/dist \
 && cp -a build /output/build \
 && cp -a public/. /output/public \
 && cp package.json /output/package.json \
 && cp prisma.config.ts /output/prisma.config.ts \
 && cp -a dist/tools /output/dist/tools \
 && cp -a prisma /output/prisma

# Final runtime image using SvelteKit adapter-node output
FROM base AS release
WORKDIR /usr/src/app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /usr/src/app/.cache \
 && chown -R bun:bun /usr/src/app/.cache \
 && chmod +x /usr/local/bin/docker-entrypoint.sh

# Use non-root user provided by Bun image
USER bun

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy all build output in one layer, then overlay production dependencies
COPY --chown=bun:bun --from=builder /output ./
COPY --chown=bun:bun --from=install-prod /temp/prod/node_modules node_modules

# Expose default app port
EXPOSE 3000/tcp

# Health check (optional, lightweight)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD bun --eval 'fetch("http://127.0.0.1:3000/").then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));'

ENTRYPOINT ["docker-entrypoint.sh"]
# Run the staged SvelteKit server directly.
CMD ["node", "build/index.js"]
