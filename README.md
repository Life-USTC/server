# Life@USTC

Start with [docs/index.md](./docs/index.md) for the project map. Product/API/MCP
contracts live in [docs/contracts/](./docs/contracts/).

## 快速开始

准备 `.bun-version` 指定的 Bun、Docker Compose 和 PostgreSQL 客户端（seed
脚本会在宿主机调用 `psql`），然后按同一顺序初始化本地环境：

```bash
bun install --frozen-lockfile
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun run app:prepare
bun run db:migrate:deploy
bunx prisma db seed
bun run dev
```

`bun run dev` 只启动 Vite，不会生成 Prisma 客户端、运行迁移或写入 seed。
本地数据库由 Docker Compose 管理；首次启动及 schema/seed 更新后，先完成上述
prepare、migrate、seed 步骤。上传存储使用 Cloudflare `R2_UPLOADS` 绑定，需通过
Wrangler 相关流程本地验证。生产应用由 Cloudflare Git integration 发布，Docker
只保留静态数据加载环境。

每 6 小时运行的 Static Sync 还会在非 dry-run 模式下按表清理最多 1000 条已过期
的 Session、VerificationToken、OAuth access/refresh token 和 DeviceCode 记录。
尚未过期的 revoked refresh token 会保留到过期，以维持 refresh-token 重放检测。

生产 Workers Builds 配置：
- Build command: `bun install --frozen-lockfile && bun run app:prepare && bun run build`
- Deploy command: `npx wrangler deploy`
- Non-production deploy command: `npx wrangler versions upload`
- Build variables:
  - `SKIP_DEPENDENCY_INSTALL=true`（使用项目自身的 Bun lockfile）
  - `BUN_VERSION=1.3.13`（与 `.bun-version` 保持一致）
- `wrangler.jsonc` 为生产配置来源，运行秘密钥通过 Cloudflare Dashboard 设置。

开发期建议节奏：
- 检查/测试/验证/提交流程以 `$life-ustc-dev-loop` 为准（见 [`.agents/skills/life-ustc-dev-loop/SKILL.md`](./.agents/skills/life-ustc-dev-loop/SKILL.md)）
- 首次本地跑浏览器/E2E 前先执行 `bunx playwright install chromium`
- 本地应用固定监听 `127.0.0.1:3000`

## 常用入口

- 开发/测试/构建工作流以 [AGENTS.md](./AGENTS.md) 为唯一准则
- 文档导航见 [docs/index.md](./docs/index.md)
- 产品/API/MCP 契约见 [docs/contracts/](./docs/contracts/)
- 代码组织从 `src/routes/`、`src/features/`、`src/lib/` 开始阅读
