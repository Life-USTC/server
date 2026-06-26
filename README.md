# Life@USTC

Start with [docs/index.md](./docs/index.md) for the project map. Product/API/MCP
contracts live in [docs/contracts/](./docs/contracts/).

## 快速开始

```bash
bun install --frozen-lockfile
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun run dev
```

首次本地启动前先从 `.env.example` 创建 `.env`，因为 `bun run dev` 会在启动 Vite 前运行 Prisma 迁移并读取 `DATABASE_URL`。本地数据库由 Docker Compose 管理；需要数据库时先启动本地 infra，再运行应用。上传存储使用 Cloudflare `R2_UPLOADS` 绑定，需通过 Wrangler 相关流程本地验证。生产应用由 Cloudflare Git integration 发布，Docker 只保留静态数据加载环境。

开发期建议节奏：
- 默认提交门禁：`bun run verify`
- 认证、数据流、浏览器流程或共享工具：`bun run verify:full`
- 首次本地跑浏览器/E2E 前先执行 `bunx playwright install chromium`
- 本地应用固定监听 `127.0.0.1:3000`

## 常用入口

- 开发/测试/构建工作流以 [AGENTS.md](./AGENTS.md) 为唯一准则
- 文档导航见 [docs/index.md](./docs/index.md)
- 产品/API/MCP 契约见 [docs/contracts/](./docs/contracts/)
- 代码组织从 `src/routes/`、`src/features/`、`src/lib/` 开始阅读
