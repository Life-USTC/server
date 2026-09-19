# Young Event 全字段暴露与规范展示 — 设计

日期：2026-09-02
状态：已与用户确认（含联系人姓名与手机号的公开展示）

## 背景

young.ustc.edu.cn 第二课堂活动数据经 static 快照导入 server。上游每条记录约
137 个键，static 侧零丢失；server 导入时仅 16 个键提升为结构化列，其余全部
留在 `rawJson`（JSONB）。当前 Web 详情页已查询 `rawJson` 但未渲染任何内容，
GraphQL 完全不暴露 `rawJson`。

用户目标：**暴露尽可能多的全部字段，并在 Web 上规范地展示出来**。已确认公开
展示联系人姓名与手机号。

## 非目标

- 不结构化上游的后台内部字段（`processInstanceId`、`delFlag`、`budgetList`、
  审核流程、强智课程、马拉松专项等恒空或纯管理用字段）；它们仍在 `rawJson` 中。
- 不改动 static 仓库的抓取逻辑（上游字段已全量入快照）。
- 不做报名/签到等写操作。

## 数据层变更

### Prisma `YoungEvent` 新增列

| 列 | 类型 | 上游键 | 含义 |
|---|---|---|---|
| `description` | `String? @db.Text` | `baseContent` | 活动介绍正文（HTML 富文本，含 `<img>`） |
| `participationNotes` | `String? @db.Text` | `conceive` | 参与方式/注意事项（HTML） |
| `activityLevel` | `String?` | `activityLevel_dictText` | 活动级别（院级/校级/省级/国家级…） |
| `module` | `String?` | `module_dictText` | 二课堂模块（德/智/体/美/劳） |
| `form` | `String?` | `form_dictText` | 参与形式（现场参与/提交作品…） |
| `grades` | `String?` | `nj` | 面向年级（逗号分隔原始值，如 `1,2,3,4,5,6`） |
| `sponsor` | `String?` | `sponsor_dictText` | 主办单位（与 `organizer` 承办单位区分） |
| `contactName` | `String?` | `linkMan` | 联系人姓名 |
| `contactTel` | `String?` | `tel` | 联系人电话 |
| `duration` | `Float?` | `duration` | 活动持续时长（小时，≠学时） |
| `serviceHour` | `Float?` | `serviceHour` | 志愿服务时长 |
| `sumHours` | `Float?` | `sumHours` | 累计认定学时（已结束活动） |
| `sumPersons` | `Int?` | `sumPersons` | 累计参与人次（已结束活动） |
| `partakeNum` | `Int?` | `partakeNum` | 实际参与人数 |
| `favCount` | `Int?` | `favCount` | 收藏数 |
| `limitNum` | `Int?` | `itemLimitNum` | 名额上限（另一口径） |
| `createdAtUpstream` | `DateTime?` | `createTime` | 上游创建时间（Asia/Shanghai） |
| `auditedAt` | `DateTime?` | `auditTime` | 上游审核时间 |
| `updatedAtUpstream` | `DateTime?` | `updateTime` | 上游更新时间 |
| `places` | `Json?` | `itemPlaceDTO.places[]` | 分时段场地：`[{ placeInfo, placeSt, placeEt }]` |

命名说明：`createdAtUpstream`/`updatedAtUpstream` 避免与 Prisma 惯例及未来
行级时间戳混淆。

### 删除 `registrationStatus` 列

上游 `registrationStatus` 键在 2556 条真实记录中全部为空/0，是死字段；真实
"报名中"状态已在 `status`（`itemStatus_dictText`）。删除该列及其在
REST/GraphQL/MCP/Web 的全部引用。**这是对三个机器接口的破坏性变更**，但该
功能上线不足一天且字段从未携带数据，接受破坏。

### 迁移与授权

- 新迁移：`ALTER TABLE` 增列 + `DROP COLUMN registrationStatus`。
- 沿用既有模式：迁移中同步 `GRANT SELECT` 给 `life_ustc_runtime`（参考
  `20260902150000_grant_young_event`——列级权限随表重建授权，新增列对既有
  表级 GRANT 自动生效，无需额外授权；DROP 列同理）。
- `prisma/seed.sql` 与 `tests/fixtures/dev-seed.ts` 同步更新（删除死字段、
  给 seed 活动补代表性新字段值）。

## 导入变更（`src/static-loader/young-plan.ts`）

1. `mapYoungEventRow` 增加上表全部映射；时间字段沿用现有 Asia/Shanghai 解析。
2. **修复 `places` 子表丢失**：快照中 `itemPlaceDTO.places` 被动态存储拆为
   独立子表（`..._records_itemPlaceDTO_places`），经 `parent_store_id` 关联
   记录行。导入时按此关联 join，提取 `placeInfo`/`placeSt`/`placeEt` 组成
   JSON 数组写入 `places` 列；空数组存 `null`。
3. 删除 `registrationStatus` 映射。

## 接口层变更

### REST（`src/lib/api/`）

- `youngEventSummarySchema` 增加全部新列（不含 `rawJson`），删除
  `registrationStatus`；`description`/`participationNotes` 仅出现在详情
  schema（避免列表载荷膨胀——单条正文可达数十 KB）。
- 详情 schema = summary + `description` + `participationNotes` + `rawJson`。
- 正文 HTML 在序列化时经共享转换函数处理（见下）。
- 更新 `docs/contracts/young-event.json` 与 `public/openapi.generated.json`
  （经 `openapi:check` 流程再生成）。

### GraphQL（`src/lib/graphql/`）

- `type YoungEvent` 补齐全部新字段，**新增 `rawJson: JSON`**（目前唯一拿不到
  原始载荷的机器接口）；删除 `registrationStatus`。
- `catalog.youngEvents` filter 增加 `module`、`activityLevel` 精确匹配。
- 更新 SDL 快照测试。

### MCP（`src/lib/mcp/tools/catalog/young-event-tools.ts`）

- `catalog_young_event_list`/`get` 增加 `module`、`activityLevel` 过滤参数。
- compact（default）模式补充 `module`、`activityLevel`、`form`；full 模式为
  全部新字段；`get` full 模式继续含 `rawJson`。
- 更新 output schemas 与契约。

### 正文 HTML 共享转换（`src/features/young/server/`）

新增一个纯函数 `renderYoungEventHtml(html)`，REST/GraphQL/MCP/Web 序列化详情时
统一调用：

1. **消毒**：复用现有 sanitize 工具（`src/lib/components/markdown-preview-sanitize.ts`
   所用的同一消毒机制），白名单标签 + 属性，剥离脚本/事件处理器。
2. **图片改写**：把 `<img src>` 中以 `https://young.ustc.edu.cn/login/` 开头
   或 `group\d/...` 相对路径统一改写为本地代理路径。代理复用
   `young-event-image-service.ts`：新增路由
   `GET /api/catalog/young-events/images/[...path]`，path 经
   `normalizeYoungEventImagePath` 校验后走同一 R2 懒缓存逻辑（图片字节与事件
   无关，R2 key 用路径本身，天然去重）。原 `[youngId]/image` 路由保留不变。

DB 中 `description`/`participationNotes` 始终存上游原始 HTML，转换只发生在
序列化层。

## Web 变更

### 详情页（`YoungEventDetailPage.svelte`）

按分区规范展示，空值分区/条目整体隐藏：

1. 头部：标题、`status`/`activityLevel`/`module`/`form` 徽标
2. 头图（`imageUrl`，现状保留）
3. 活动介绍：`description` 消毒后 `{@html}` 渲染
4. 时间与报名：活动起止、报名窗口、创建/审核/更新时间
5. 人数与学时：名额/已报名/实际参与/累计人次、学时/志愿时长/持续时长/累计学时
6. 组织与联系：主办（`sponsor`）/承办（`organizer`）/部门/联系人/联系电话
7. 场地：`places` 列表（场地、起止）；无分时段场地时回退显示 `location`
8. 参与须知：`participationNotes` 消毒渲染
9. 收藏数 `favCount`、面向年级 `grades`（原始值规范化展示）

### 列表页（`YoungEventsPage.svelte`）

- 新增 `module`、`activityLevel` 两个筛选（精确匹配）。选项用固定枚举：
  模块为德/智/体/美/劳；级别为班级/院级/校级/省级/国家级。数据中出现枚举
  外取值时不作为筛选项，仅作徽标展示。
- 列表项增加 `module`/`activityLevel` 徽标。
- 删除 `registrationStatus` 展示。

### i18n

`messages/zh-cn.json` 与 `messages/en-us.json` 同步新增全部文案键。

## 缓存与渲染

详情页 SSR 输出变化，`docs/rendering-and-cache.md` 中的公开缓存规则不变
（URL 未变）；正文图片经代理后带 immutable 缓存头，与封面图一致。

## 测试

- 单元：`mapYoungEventRow` 新映射（含 places join、时间解析）；HTML 消毒 +
  图片改写函数；REST/GraphQL/MCP 序列化形状。
- 快照：GraphQL SDL 快照、MCP 工具 output schema 测试同步更新。
- 集成：REST 详情含新字段与改写后的图片 URL。
- 本地用 127.0.0.1:55433 的独立开发库验证（**不碰 5432 主开发库**）。
- 默认检查套件按根 AGENTS.md 执行（biome、svelte-check、tsc×3、vitest、
  openapi:check、GraphQL 快照）。

## 风险与注意

- **隐私**：联系人姓名/手机号公开展示，用户已确认。
- `registrationStatus` 删除属破坏性接口变更（见上，可接受）。
- `baseContent` 内嵌图片需登录态的上游资源无法代理（代理无 token）；按
  现有封面图代理的实际表现，图片路径无需鉴权，若个别 403 则返回占位/隐藏。
- 上游 `applyNum` 对进行中活动恒为 0、`peopleNum` 常为 NULL，属上游数据
  事实，展示层做空值隐藏，不做额外修补。
