# Life@USTC Server

科大校园工作区的主应用与 API 真源。用户通过 Web 使用；CLI、Bot、iOS 与 MCP
代理都连到这里。生产站点：
[https://life-ustc.tiankaima.dev](https://life-ustc.tiankaima.dev)

## 产品能力

| 域 | 用户能做什么 |
|----|--------------|
| **校园目录** | 搜课程 / 教学班 / 教师并看详情；查学期课表与考试；校车时刻与地图；校园链接目录；全局搜索 |
| **工作区** | 登录后看概览与日历；管理待办；标记作业完成；查看考试；订阅教学班（含导入）；导出 iCal；置顶常用链接；上传文件 |
| **社区** | 公开用户主页；对课程等内容评论 / 反应；编辑描述；共建教学班作业 |
| **账户** | USTC OAuth / Passkey 等登录；资料与偏好（语言）；关联账号与授权；注销相关设置 |
| **管理** | 用户与封禁、内容审核、OAuth 客户端、校车数据治理 |

工作区 Web 页签：`/workspace/{overview,calendar,homeworks,todos,exams,subscriptions}`
（另有订阅子路由）。课表 / 上传等能力主要走 API 与其它表面，不一定有独立 Web 页。

## 对外接口

同一套能力通过多种传输暴露（命名见
[docs/interface-hierarchy.md](./docs/interface-hierarchy.md)）：

- **Web** — SvelteKit 页面（公开目录 + 登录工作区 + 管理端）
- **REST** — `/api/catalog|workspace|community|account|admin|…`（OpenAPI 见 `/api-docs`）
- **GraphQL** — `/api/graphql`（`catalog` / `workspace` / `community` / `account`）
- **MCP** — `/api/mcp`，供代理与 Bot agent 调用 capability 级工具
- **OAuth** — 授权页、设备码等，供 CLI / Bot / 第三方客户端登录

契约与模块说明在 [docs/contracts/](./docs/contracts/)。文档导航：
[docs/index.md](./docs/index.md)。

## 给贡献者

- 架构地图（目录与表面）→ [AGENTS.md](./AGENTS.md)
- 新功能如何拆模块与补测试 → [`.agents/skills/life-ustc-feature`](./.agents/skills/life-ustc-feature/SKILL.md)
- 生产连接 / Workers Builds → [docs/operations.md](./docs/operations.md)
- 公开页 SSR 与缓存 → [docs/rendering-and-cache.md](./docs/rendering-and-cache.md)
- 提交、PR、等 CI、review、合并 → 使用全局 agent skills（不在本仓库）
