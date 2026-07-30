# Life@USTC

Start with [docs/index.md](./docs/index.md) for the project map. Product/API/MCP
contracts live in [docs/contracts/](./docs/contracts/).

## 快速开始

准备 `.bun-version` 指定的 Bun、Docker Compose 和 PostgreSQL 客户端（seed
脚本会在宿主机调用 `psql`），然后按同一顺序初始化本地环境：

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

`bun run dev` 只启动 Vite，不会生成 Prisma 客户端、运行迁移或写入 seed。
本地数据库由 Docker Compose 管理；首次启动及 schema/seed 更新后，先完成上述
prepare、migrate、seed 步骤。上传存储使用 Cloudflare `R2_UPLOADS` 绑定，需通过
Wrangler 相关流程本地验证。生产应用由 Cloudflare Git integration 发布，Docker
只保留静态数据加载环境。

独立的 Auth Record Cleanup workflow 每 6 小时按表清理最多 1000 条已过期的
Session、VerificationToken、OAuth access/refresh token 和 DeviceCode 记录，也可手动
触发。它不运行 migration 或静态数据导入；尚未过期的 revoked refresh token 会保留
到过期，以维持 refresh-token 重放检测。

运行时数据库连接按 app 与 auth 边界分离。Node production 必须同时提供
`DATABASE_URL` 和 `AUTH_DATABASE_URL`；Cloudflare Worker 必须同时配置
`HYPERDRIVE` 和 `HYPERDRIVE_AUTH`。认证连接承载 session、token、OAuth 和 Better
Auth 写入，必须使用独立的最小权限角色，并在 Hyperdrive 中关闭 query cache，以保证
撤销与权限变更在下一次请求立即生效。production 不会回退到 app 连接；缺少 auth
连接时启动检查直接失败。本地开发和测试可暂时让两个连接指向同一数据库。

生产 app runtime 数据库角色切换前后，使用只读 preflight 验证 origin/current 角色身份、
经审核的全量 schema/表/列/序列/函数权限 allowlist、公共与默认权限、RLS policy、所有权
和缺失用户上下文时的默认拒绝；五个权限变量均为按 `Object:PRIVILEGE` 排序的逗号分隔列表，
输出只包含布尔契约，不包含业务行：

```bash
psql "$APP_RUNTIME_DATABASE_URL" -X \
  -v expected_role=app_runtime \
  -v expected_schema_privileges="$APP_RUNTIME_SCHEMA_PRIVILEGES" \
  -v expected_table_privileges="$APP_RUNTIME_TABLE_PRIVILEGES" \
  -v expected_column_privileges="$APP_RUNTIME_COLUMN_PRIVILEGES" \
  -v expected_sequence_privileges="$APP_RUNTIME_SEQUENCE_PRIVILEGES" \
  -v expected_function_privileges="$APP_RUNTIME_FUNCTION_PRIVILEGES" \
  -f prisma/roles/verify-app-runtime.sql
```

生产 Workers Builds 配置：
- Build command: `bun install --frozen-lockfile && bun run app:prepare && bun run build`
- Deploy command: `npx wrangler deploy`
- Non-production deploy command: `npx wrangler versions upload`
- Build variables:
  - `SKIP_DEPENDENCY_INSTALL=true`（使用项目自身的 Bun lockfile）
  - `BUN_VERSION=1.3.13`（与 `.bun-version` 保持一致）
- `wrangler.jsonc` 为生产配置来源，运行秘密钥通过 Cloudflare Dashboard 设置。
- 生产配置关闭公开 `workers.dev`、version 和 alias preview URL；非生产分支仍会
  上传 Worker version 供构建检查，但不会生成可访问的在线预览地址。

开发期建议节奏：
- 检查/测试/验证/提交流程以 `$life-ustc-dev-loop` 为准（见 [`.agents/skills/life-ustc-dev-loop/SKILL.md`](./.agents/skills/life-ustc-dev-loop/SKILL.md)）
- 首次本地跑浏览器/E2E 前先执行 `bunx playwright install chromium`
- 本地应用固定监听 `127.0.0.1:3000`

## 常用入口

- 开发/测试/构建工作流以 [AGENTS.md](./AGENTS.md) 为唯一准则
- 文档导航见 [docs/index.md](./docs/index.md)
- 产品/API/MCP 契约见 [docs/contracts/](./docs/contracts/)
- 代码组织从 `src/routes/`、`src/features/`、`src/lib/` 开始阅读
