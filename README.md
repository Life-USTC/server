# Life@USTC Server

SvelteKit campus workspace with REST, GraphQL, and MCP APIs.

Start with [docs/index.md](./docs/index.md). Product/API/MCP contracts live in
[docs/contracts/](./docs/contracts/). Cross-surface capability tree:
[docs/interface-hierarchy.md](./docs/interface-hierarchy.md).

## Quick start

Needs Bun (see `.bun-version`), Docker Compose, and a host `psql` client (seed
uses it):

```bash
bun install --frozen-lockfile
bun run hooks:install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare
bun run db:migrate:deploy
bunx prisma db seed
bun run dev
```

`bun run dev` only starts Vite on `127.0.0.1:3000`. Prepare, migrate, and seed
separately when schema or fixtures change. Upload storage uses the Cloudflare
`R2_UPLOADS` binding (exercise via Wrangler). Production deploys through
Cloudflare Git integration; Docker here is only for local Postgres and the
static data loader.

First browser/E2E run: `bunx playwright install chromium`.

## Operations

Auth DB separation, Workers Builds settings, runtime role preflight, and Auth
Record Cleanup are documented in
[docs/operations.md](./docs/operations.md). Rendering/cache boundaries:
[docs/rendering-and-cache.md](./docs/rendering-and-cache.md).

## Agent workflows

- Checks/tests/handoff: `$life-ustc-dev-loop`
  ([`.agents/skills/life-ustc-dev-loop/SKILL.md`](./.agents/skills/life-ustc-dev-loop/SKILL.md))
- Coding rules: [AGENTS.md](./AGENTS.md)
