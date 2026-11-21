# Life@USTC Server

The Life@USTC campus app and API for Web, CLI, Bot, iOS, and MCP clients.

Production: [life-ustc.tiankaima.dev](https://life-ustc.tiankaima.dev)

Product requirements, feature scope, permissions, and interface presentation are
maintained as structured specifications. Start with the [documentation index](docs/index.md)
or inspect a feature:

```bash
bun run specs:list
bun run specs:show homework
bun run specs:check
```

## Quick start

Needs Bun (version in `.bun-version`), Docker Compose, and PostgreSQL 16 client
tools (`psql`, `pg_dump`).

```bash
bun install --frozen-lockfile && bun run hooks:install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare && bun run db:migrate:deploy
ALLOW_DATABASE_SEED=true bunx prisma db seed
bun run dev            # http://127.0.0.1:3000
bun run check          # static, type, specification, and unit checks
```

For tests, specification changes, and API contracts, read
[CONTRIBUTING.md](CONTRIBUTING.md).
Production monitoring and deploy runbooks are kept out of the public tree.
