# Life@USTC

- Feature specs: [docs/features/](./docs/features/)

## 快速开始

```bash
bun install --frozen-lockfile
bun run dev:infra  # start postgres/minio
bun run dev        # prepare DB and start SvelteKit
```

可用命令（开发）:

```bash
bun run dev:down        # stop dev containers
bun run dev:infra:clean # reset local dev containers/volumes when needed
bun run dev:docker      # run the full dev stack in Docker
bun run test:e2e        # build and run Playwright E2E
```

开发期建议节奏：
- 代码迭代：`bun run dev`
- 改完一个文件后：`bun run verify:edit`
- 完成一个功能后：`bun run verify:feature`
- 提交前：`bun run verify:commit`
- 页面级回归：`bun run test:e2e -- tests/e2e/src/app/<page>/test.ts`
- 涉及浏览器/认证/数据流时：`bun run verify:full`
- 本地开发固定监听 `127.0.0.1:3000`

## 常用入口

- 开发/测试/构建工作流以 [AGENTS.md](./AGENTS.md) 为唯一准则
- 文档导航见 [docs/index.md](./docs/index.md)
- 领域契约与功能规格见 [docs/features/](./docs/features/)
- 代码组织从 `src/routes/`、`src/features/`、`src/lib/` 开始阅读
