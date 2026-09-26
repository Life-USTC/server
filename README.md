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

For code layout and local checks, read [AGENTS.md](AGENTS.md). For an end-to-end
behavior change, use [life-ustc-implement](.agents/skills/life-ustc-implement/SKILL.md).
Production monitoring and deploy runbooks are kept out of the public tree.
