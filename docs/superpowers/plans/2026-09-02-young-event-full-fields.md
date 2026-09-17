# Young Event 全字段暴露与规范展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 young.ustc.edu.cn 活动的高价值上游字段（约 20 个）结构化到 DB，暴露到 REST/GraphQL/MCP，并在 Web 上分区规范展示。

**Architecture:** 导入层（static-loader）扩展映射并补回 places 子表；序列化层新增共享 HTML 消毒+图片改写函数；REST/GraphQL/MCP/Web 四接口同步扩展。Spec: `docs/superpowers/specs/2026-09-02-young-event-full-fields-design.md`（权威字段表以此为准）。

**Tech Stack:** SvelteKit + Prisma(PostgreSQL) + Zod + GraphQL Yoga + MCP SDK + unified/rehype。

## Global Constraints

- 工作目录：`/home/tiankaima/Source/Life-USTC/worktrees/server-young-event-full-fields`（分支 `feat/young-event-full-fields`）。
- 用户已确认：联系人姓名与手机号（`contactName`/`contactTel`）公开展示。
- i18n：`messages/zh-cn.json`（默认）与 `messages/en-us.json` 必须同步新增键。
- 不手改 `src/generated/prisma*/`、`public/openapi.generated.json`（后者经生成脚本更新）。
- 时间字段解析沿用 `young-plan.ts` 的 `asShanghaiDateTime`；输出沿用 `formatShanghaiTimestamp`。
- 每个任务结束运行该任务标注的验证命令；commit message 用英文 conventional commits。
- 上游正文 HTML 存 DB 的是原文，消毒/图片改写只发生在序列化层。
- **DB 里删除 `registrationStatus` 列**及其在全部接口/Web 的引用（上游恒空的死字段）。

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`（`YoungEvent` 模型，约 1869-1894 行）
- Create: `prisma/migrations/20260902120000_young_event_full_fields/migration.sql`
- Modify: `prisma/seed.sql`、`tests/fixtures/dev-seed.ts`（young 相关行）

**Interfaces:**
- Produces: 新列供 Task 2/5 使用——`description String? @db.Text`、`participationNotes String? @db.Text`、`activityLevel String?`、`module String?`、`form String?`、`grades String?`、`sponsor String?`、`contactName String?`、`contactTel String?`、`duration Float?`、`serviceHour Float?`（db 列名 `serviceHour`）、`sumHours Float?`、`sumPersons Int?`、`partakeNum Int?`、`favCount Int?`、`limitNum Int?`、`createdAtUpstream DateTime?`、`auditedAt DateTime?`、`updatedAtUpstream DateTime?`、`places Json?`。删除 `registrationStatus`。

- [ ] **Step 1: 修改 schema.prisma**

在 `YoungEvent` 模型中删除 `registrationStatus` 行，新增：

```prisma
  description        String?   @db.Text
  participationNotes String?   @db.Text
  activityLevel      String?
  module             String?
  form               String?
  grades             String?
  sponsor            String?
  contactName        String?
  contactTel         String?
  duration           Float?
  serviceHour        Float?
  sumHours           Float?
  sumPersons         Int?
  partakeNum         Int?
  favCount           Int?
  limitNum           Int?
  createdAtUpstream  DateTime?
  auditedAt          DateTime?
  updatedAtUpstream  DateTime?
  places             Json?
```

- [ ] **Step 2: 写迁移 SQL**

目录名 `20260902120000_young_event_full_fields`（若与现有迁移冲突则顺延时间戳）。内容：

```sql
ALTER TABLE "YoungEvent"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "participationNotes" TEXT,
  ADD COLUMN "activityLevel" TEXT,
  ADD COLUMN "module" TEXT,
  ADD COLUMN "form" TEXT,
  ADD COLUMN "grades" TEXT,
  ADD COLUMN "sponsor" TEXT,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactTel" TEXT,
  ADD COLUMN "duration" DOUBLE PRECISION,
  ADD COLUMN "serviceHour" DOUBLE PRECISION,
  ADD COLUMN "sumHours" DOUBLE PRECISION,
  ADD COLUMN "sumPersons" INTEGER,
  ADD COLUMN "partakeNum" INTEGER,
  ADD COLUMN "favCount" INTEGER,
  ADD COLUMN "limitNum" INTEGER,
  ADD COLUMN "createdAtUpstream" TIMESTAMP(3),
  ADD COLUMN "auditedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAtUpstream" TIMESTAMP(3),
  ADD COLUMN "places" JSONB,
  DROP COLUMN "registrationStatus";
```

参考 `prisma/migrations/20260901210000_add_young_event/migration.sql` 与
`20260902150000_grant_young_event/migration.sql` 的既有格式；若 grant 迁移
用的是表级 `GRANT SELECT ON TABLE`，新增列自动覆盖，无需新授权——先读该文件
确认，若是列级授权则在本迁移末尾补 `GRANT SELECT (...) ON "YoungEvent" TO life_ustc_runtime;`。

- [ ] **Step 3: 更新 seed 与 dev fixtures**

`prisma/seed.sql` 与 `tests/fixtures/dev-seed.ts` 中 YoungEvent 相关行：删除
`registrationStatus` 值，给至少一条 seed 活动补 `description`（含一张
`https://young.ustc.edu.cn/login/group1/...jpg` 的 `<img>`）、`activityLevel`、
`module`、`sponsor`、`contactName`、`contactTel`、`places` 示例值，供集成/E2E 使用。

- [ ] **Step 4: 验证**

Run: `bun run app:prepare`（重新生成 Prisma client）+ `bun run db:migrate:deploy`
Expected: 无错误；`bunx tsc --noEmit -p tsconfig.typecheck.json` 的剩余报错只属于
后续任务要改的文件（young-event-service 等引用 registrationStatus 处）。

- [ ] **Step 5: Commit**

```bash
git add prisma/ tests/fixtures/dev-seed.ts src/generated
git commit -m "feat(young): add full-field columns to YoungEvent, drop dead registrationStatus"
```

---

### Task 2: static-loader 映射扩展 + places 子表补回

**Files:**
- Modify: `src/static-loader/young-plan.ts`
- Test: `tests/unit/static-loader-young-plan.test.ts`

**Interfaces:**
- Consumes: Task 1 的新列；`Snapshot.queryGrouped(tableName)`（`src/static-loader/snapshot.ts`，按 `parent_store_id` 分组）。
- Produces: `YoungEventBuild` 增加与 Task 1 同名字段；`places?: Array<{ placeInfo?: string; placeSt?: string; placeEt?: string }>`。

- [ ] **Step 1: 写失败测试**

在 `tests/unit/static-loader-young-plan.test.ts` 增加用例（先读现有测试了解其
构造内存快照的方式，沿用同款 fixture helper）：

- 映射新字段：`baseContent→description`、`conceive→participationNotes`、
  `activityLevel_dictText→activityLevel`、`module_dictText→module`、
  `form_dictText→form`、`nj→grades`、`sponsor_dictText→sponsor`、
  `linkMan→contactName`、`tel→contactTel`、`duration`、`serviceHour`、
  `sumHours`、`sumPersons`、`partakeNum`、`favCount`、`itemLimitNum→limitNum`、
  `createTime→createdAtUpstream`、`auditTime→auditedAt`、`updateTime→updatedAtUpstream`。
- places join：快照含 `<table>_itemPlaceDTO`（列 `store_id,parent_store_id,itemId`）
  与 `<table>_itemPlaceDTO_places`（列 `store_id,parent_store_id,position,placeInfo,placeSt,placeEt`）时，
  记录带上按 `position` 排序的 `places` 数组；无子表或空子表时 `places` 为 `undefined`。
- 不再有 `registrationStatus` 输出。

```typescript
it("maps extended fields and joins places subtables", () => {
  const snapshot = makeSnapshot({
    [ENDED_TABLE]: [
      { store_id: 1, id: "ev1", itemName: "活动", baseContent: "<p>介绍</p>",
        conceive: "<p>须知</p>", activityLevel_dictText: "院级",
        module_dictText: "美", form_dictText: "提交作品", nj: "1,2",
        sponsor_dictText: "校团委", linkMan: "张三", tel: "13800000000",
        duration: 2.5, serviceHour: 2, sumHours: 76, sumPersons: 27,
        partakeNum: 30, favCount: 4, itemLimitNum: 50,
        createTime: "2026-08-08 23:53:40", auditTime: "2026-08-10 10:24:19",
        updateTime: "2026-08-11 08:00:00" },
    ],
    [`${ENDED_TABLE}_itemPlaceDTO`]: [
      { store_id: 10, parent_store_id: 1, itemId: "ev1" },
    ],
    [`${ENDED_TABLE}_itemPlaceDTO_places`]: [
      { store_id: 100, parent_store_id: 10, position: 0, placeInfo: "东区礼堂",
        placeSt: "2026-08-20 14:00:00", placeEt: "2026-08-20 16:00:00" },
    ],
  });
  const events = loadYoungEvents(snapshot);
  expect(events).toHaveLength(1);
  const ev = events![0]!;
  expect(ev.description).toBe("<p>介绍</p>");
  expect(ev.activityLevel).toBe("院级");
  expect(ev.module).toBe("美");
  expect(ev.contactTel).toBe("13800000000");
  expect(ev.createdAtUpstream?.toISOString()).toBe("2026-08-08T15:53:40.000Z");
  expect(ev.places).toEqual([
    { placeInfo: "东区礼堂", placeSt: "2026-08-20 14:00:00", placeEt: "2026-08-20 16:00:00" },
  ]);
  expect("registrationStatus" in ev).toBe(false);
});
```

（`makeSnapshot`/表名常量按现有测试文件的实际 helper 调整。）

- [ ] **Step 2: 运行确认失败**

Run: `bunx vitest run tests/unit/static-loader-young-plan.test.ts`
Expected: FAIL（`YoungEventBuild` 无这些字段）。

- [ ] **Step 3: 实现 `young-plan.ts`**

`YoungEventBuild` 删除 `registrationStatus`，新增：

```typescript
export type YoungEventPlace = {
  placeInfo?: string;
  placeSt?: string;
  placeEt?: string;
};

export type YoungEventBuild = {
  // ...保留原有字段（除 registrationStatus）...
  description?: string;
  participationNotes?: string;
  activityLevel?: string;
  module?: string;
  form?: string;
  grades?: string;
  sponsor?: string;
  contactName?: string;
  contactTel?: string;
  duration?: number;
  serviceHour?: number;
  sumHours?: number;
  sumPersons?: number;
  partakeNum?: number;
  favCount?: number;
  limitNum?: number;
  createdAtUpstream?: Date;
  auditedAt?: Date;
  updatedAtUpstream?: Date;
  places?: YoungEventPlace[];
};
```

`mapYoungEventRow` 增加第三参 `places?: YoungEventPlace[]`，映射：

```typescript
    description: asString(row.baseContent),
    participationNotes: asString(row.conceive),
    activityLevel: asString(row.activityLevel_dictText),
    module: asString(row.module_dictText),
    form: asString(row.form_dictText),
    grades: asString(row.nj),
    sponsor: asString(row.sponsor_dictText),
    contactName: asString(row.linkMan),
    contactTel: asString(row.tel),
    duration: asFloat(row.duration),
    serviceHour: asFloat(row.serviceHour),
    sumHours: asFloat(row.sumHours),
    sumPersons: asInt(row.sumPersons),
    partakeNum: asInt(row.partakeNum),
    favCount: asInt(row.favCount),
    limitNum: asInt(row.itemLimitNum),
    createdAtUpstream: asShanghaiDateTime(row.createTime),
    auditedAt: asShanghaiDateTime(row.auditTime),
    updatedAtUpstream: asShanghaiDateTime(row.updateTime),
    places,
```

`loadYoungEvents` 中为每张记录表构建 places 索引（两级 join：
记录 `store_id` → itemPlaceDTO `parent_store_id` → places `parent_store_id`）：

```typescript
function loadPlacesByRecordStoreId(
  snapshot: Snapshot,
  recordsTable: string,
): Map<number, YoungEventPlace[]> {
  const dtoTable = `${recordsTable}_itemPlaceDTO`;
  const placesTable = `${recordsTable}_itemPlaceDTO_places`;
  const result = new Map<number, YoungEventPlace[]>();
  if (!snapshot.hasTable(dtoTable) || !snapshot.hasTable(placesTable)) {
    return result;
  }
  const dtosByRecord = snapshot.queryGrouped(dtoTable);
  const placesByDto = snapshot.queryGrouped(placesTable);
  for (const [recordStoreId, dtos] of dtosByRecord) {
    const places: YoungEventPlace[] = [];
    for (const dto of dtos) {
      const dtoStoreId = asInt(dto.store_id);
      if (dtoStoreId == null) continue;
      const rows = (placesByDto.get(dtoStoreId) ?? []).slice();
      rows.sort(
        (a, b) => (asInt(a.position) ?? 0) - (asInt(b.position) ?? 0),
      );
      for (const row of rows) {
        places.push({
          placeInfo: asString(row.placeInfo),
          placeSt: asString(row.placeSt),
          placeEt: asString(row.placeEt),
        });
      }
    }
    if (places.length > 0) result.set(recordStoreId, places);
  }
  return result;
}
```

`loadYoungEvents` 里对 ACTIVE/ENDED 两表各调一次，用
`placesByRecord.get(asInt(row.store_id) ?? -1)` 传给 `mapYoungEventRow`。

- [ ] **Step 4: 运行确认通过**

Run: `bunx vitest run tests/unit/static-loader-young-plan.test.ts`
Expected: PASS（含既有用例，既有用例中 registrationStatus 断言需同步删除）。

- [ ] **Step 5: 检查 import.ts 写入路径**

`src/static-loader/import.ts` 的 `syncYoungEvents`（约 1321-1397 行）若逐列
枚举字段写入，需同步增删列（删 `registrationStatus`，加上表全部新列，
`places` 传 `JSON.stringify` 或 Prisma Json 直写——按该函数现有写法对齐）。
若它整体透传 `YoungEventBuild` 则只需删 registrationStatus 引用。改完运行
`bunx tsc --noEmit -p tsconfig.typecheck.operational.json` 确认通过。

- [ ] **Step 6: Commit**

```bash
git add src/static-loader/ tests/unit/static-loader-young-plan.test.ts
git commit -m "feat(static-loader): map full young event fields and join places subtables"
```

---

### Task 3: 正文 HTML 消毒 + 图片改写共享函数

**Files:**
- Create: `src/features/young/server/young-event-html.ts`
- Test: `tests/unit/young-event-html.test.ts`
- Modify: `package.json`（新增 `rehype-parse` 依赖）

**Interfaces:**
- Produces: `renderYoungEventHtml(html: string): string` —— 输入上游原始 HTML，
  输出消毒后且 `<img>` 的 young 图床 src 已改写为 `/api/catalog/young-events/images/<path>` 的 HTML。
  供 Task 5（service 序列化）使用。

- [ ] **Step 1: 安装依赖**

```bash
bun add rehype-parse
```

（`unified`、`rehype-sanitize`、`rehype-stringify` 已在 package.json。）

- [ ] **Step 2: 写失败测试**

```typescript
import { describe, expect, it } from "vitest";
import { renderYoungEventHtml } from "@/features/young/server/young-event-html";

describe("renderYoungEventHtml", () => {
  it("rewrites absolute young image URLs to the local proxy", () => {
    const out = renderYoungEventHtml(
      '<p>看图</p><img src="https://young.ustc.edu.cn/login/group1/M00/31/B5/x.jpg">',
    );
    expect(out).toContain('src="/api/catalog/young-events/images/group1/M00/31/B5/x.jpg"');
    expect(out).toContain("<p>看图</p>");
  });

  it("rewrites relative pic paths", () => {
    const out = renderYoungEventHtml('<img src="group1/M00/x.png">');
    expect(out).toContain('src="/api/catalog/young-events/images/group1/M00/x.png"');
  });

  it("strips scripts and event handlers", () => {
    const out = renderYoungEventHtml(
      '<p onclick="alert(1)">a</p><script>alert(2)</script>',
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
  });

  it("leaves foreign image hosts untouched", () => {
    const out = renderYoungEventHtml('<img src="https://example.com/a.png">');
    expect(out).toContain('src="https://example.com/a.png"');
  });

  it("drops unsafe young paths that fail normalization", () => {
    const out = renderYoungEventHtml(
      '<img src="https://young.ustc.edu.cn/login/../secret.jpg">',
    );
    expect(out).not.toContain("secret.jpg");
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `bunx vitest run tests/unit/young-event-html.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现**

```typescript
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { markdownSanitizeSchema, rehypeSanitize } from "@/lib/components/markdown-preview-sanitize";
import { normalizeYoungEventImagePath } from "./young-event-image-service";

const YOUNG_IMAGE_ORIGIN = "https://young.ustc.edu.cn/login/";
const LOCAL_IMAGE_PREFIX = "/api/catalog/young-events/images/";

function rewriteSrc(src: unknown): string | null {
  if (typeof src !== "string" || src.trim() === "") return null;
  const trimmed = src.trim();
  const rawPath = trimmed.startsWith(YOUNG_IMAGE_ORIGIN)
    ? trimmed.slice(YOUNG_IMAGE_ORIGIN.length)
    : trimmed;
  // 只处理 young 图床路径（group\d/...），外站图片原样保留
  if (trimmed.startsWith("http") && !trimmed.startsWith(YOUNG_IMAGE_ORIGIN)) {
    return null;
  }
  const normalized = normalizeYoungEventImagePath(rawPath);
  return normalized == null ? "" : `${LOCAL_IMAGE_PREFIX}${normalized}`;
}

/**
 * Sanitize upstream rich-text HTML and rewrite young.ustc.edu.cn image URLs
 * to the local R2-backed proxy. Stored DB content stays raw; this runs at
 * serialization time only.
 */
export function renderYoungEventHtml(html: string): string {
  const file = unified()
    .use(rehypeParse, { fragment: true })
    .use(() => (tree) => {
      visit(tree, "element", (node) => {
        if (node.tagName !== "img") return;
        const rewritten = rewriteSrc(node.properties?.src);
        if (rewritten === null) return;
        if (rewritten === "") {
          delete node.properties?.src;
          return;
        }
        node.properties = { ...node.properties, src: rewritten };
      });
    })
    .use(rehypeSanitize, markdownSanitizeSchema)
    .use(rehypeStringify)
    .processSync(html);
  return String(file);
}
```

注意：`unist-util-visit` 若不在依赖中则 `bun add unist-util-visit`（先查
package.json，unified 生态很可能已带）。sanitize schema 需允许 `img.src`
（`markdownSanitizeSchema` 已允许）。

- [ ] **Step 5: 运行确认通过**

Run: `bunx vitest run tests/unit/young-event-html.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/features/young/server/young-event-html.ts tests/unit/young-event-html.test.ts
git commit -m "feat(young): sanitize rich text and proxy inline images"
```

---

### Task 4: 图片代理泛化（按路径直代理）

**Files:**
- Modify: `src/features/young/server/young-event-image-service.ts`
- Modify: `src/lib/api/routes/young-event-routes.ts`
- Create: `src/routes/api/catalog/young-events/images/[...path]/+server.ts`
- Test: `tests/unit/young-event-image-route.test.ts`（扩展现有）

**Interfaces:**
- Consumes: Task 3 生成的 `/api/catalog/young-events/images/<path>` URL。
- Produces: `getYoungEventImageByPathResponse(input: { request: Request; imagePath: string; defer?: (p: Promise<unknown>) => void }): Promise<Response | null>`；
  路由 `GET /api/catalog/young-events/images/[...path]`。

- [ ] **Step 1: 写失败测试**

在 `tests/unit/young-event-image-route.test.ts` 增加：

```typescript
it("serves R2-cached bytes for an arbitrary normalized image path", async () => {
  // 沿用现有测试的 bucket mock：预设 key "young-events/images/group1/M00/x.jpg"
  const response = await getYoungEventImageByPathRoute(
    new Request("https://local.test/api/catalog/young-events/images/group1/M00/x.jpg"),
    { path: "group1/M00/x.jpg" },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/jpeg");
});

it("rejects path traversal", async () => {
  const response = await getYoungEventImageByPathRoute(
    new Request("https://local.test/api/catalog/young-events/images/../x.jpg"),
    { path: "../x.jpg" },
  );
  expect(response.status).toBe(404);
});
```

- [ ] **Step 2: 运行确认失败** → `bunx vitest run tests/unit/young-event-image-route.test.ts`，FAIL。

- [ ] **Step 3: 重构 image service**

`young-event-image-service.ts`：把 `getYoungEventImageResponse` 中
"拿到 imagePath 之后"的全部逻辑抽成

```typescript
export async function getYoungEventImageByPathResponse(input: {
  request: Request;
  imagePath: string;
  defer?: (promise: Promise<unknown>) => void;
}): Promise<Response | null> {
  const imagePath = normalizeYoungEventImagePath(input.imagePath);
  if (!imagePath) return null;
  // …原有 bucket/缓存/回源逻辑原样搬入…
}
```

原 `getYoungEventImageResponse` 变为：查 DB 得 `imageUrl` → 调
`getYoungEventImageByPathResponse` 并透传。

- [ ] **Step 4: 新增路由**

`young-event-routes.ts` 增加（错误处理复用 `getYoungEventImageRoute` 的三段
catch，404 文案 `Young event image not found`）：

```typescript
export async function getYoungEventImageByPathRoute(
  request: Request,
  params: { path: string },
  options: { defer?: (promise: Promise<unknown>) => void } = {},
) {
  try {
    const result = await getYoungEventImageByPathResponse({
      request,
      imagePath: params.path,
      defer: options.defer,
    });
    if (!result) {
      const response = notFound("Young event image not found");
      response.headers.set("Cache-Control", "public, max-age=300");
      return response;
    }
    return result;
  } catch (error) {
    // 与 getYoungEventImageRoute 相同的 YoungEventImageStorageUnavailableError /
    // YoungEventImageOriginError 分支
    return handleRouteError("Failed to fetch young event image", error);
  }
}
```

`src/routes/api/catalog/young-events/images/[...path]/+server.ts`（仿照
`[youngId]/image/+server.ts`，含同款 JSDoc `@response` 注解，供 OpenAPI 生成）：

```typescript
import type { RequestHandler } from "@sveltejs/kit";
import { getCloudflareTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { getYoungEventImageByPathRoute } from "@/lib/api/routes/young-event-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Serve a cached rich-text inline image for Young events by upstream pic path.
 * @response binary
 * @response 304
 * @response 404:openApiErrorSchema
 * @response 502:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params, platform }) =>
  observedApiRoute(() =>
    getYoungEventImageByPathRoute(
      request,
      { path: params.path },
      { defer: getCloudflareTaskScheduler(platform) },
    ),
  )(request);
```

- [ ] **Step 5: 运行确认通过** → `bunx vitest run tests/unit/young-event-image-route.test.ts`，PASS。

- [ ] **Step 6: Commit**

```bash
git add src/features/young/server/young-event-image-service.ts src/lib/api/routes/young-event-routes.ts "src/routes/api/catalog/young-events/images" tests/unit/young-event-image-route.test.ts
git commit -m "feat(young): proxy rich-text images by upstream path"
```

---

### Task 5: young-event-service 序列化扩展

**Files:**
- Modify: `src/features/young/server/young-event-service.ts`
- Test: `tests/unit/young-event-service.test.ts`

**Interfaces:**
- Consumes: Task 1 列、Task 3 `renderYoungEventHtml`。
- Produces（Task 6/7/8/9/10 依赖的确切类型）：

```typescript
export type YoungEventPlace = {
  placeInfo: string | null;
  placeSt: string | null;
  placeEt: string | null;
};

export type YoungEventSummary = {
  youngId: string;
  name: string;
  category: string | null;
  department: string | null;
  organizer: string | null;
  status: string | null;
  location: string | null;
  imageUrl: string | null;
  hours: number | null;
  capacity: number | null;
  appliedCount: number | null;
  startAt: string | null;
  endAt: string | null;
  applyStartAt: string | null;
  applyEndAt: string | null;
  isActive: boolean;
  // 新增：
  activityLevel: string | null;
  module: string | null;
  form: string | null;
  grades: string | null;
  sponsor: string | null;
  contactName: string | null;
  contactTel: string | null;
  duration: number | null;
  serviceHour: number | null;
  sumHours: number | null;
  sumPersons: number | null;
  partakeNum: number | null;
  favCount: number | null;
  limitNum: number | null;
  createdAtUpstream: string | null;
  auditedAt: string | null;
  updatedAtUpstream: string | null;
  places: YoungEventPlace[] | null;
};

export type YoungEventDetail = YoungEventSummary & {
  description: string | null;        // 已经过 renderYoungEventHtml
  participationNotes: string | null; // 已经过 renderYoungEventHtml
  rawJson: Prisma.JsonValue;
};

export type YoungEventListInput = PaginationInput & {
  active?: boolean | null;
  category?: string | null;
  module?: string | null;
  activityLevel?: string | null;
  search?: string | null;
};
```

- [ ] **Step 1: 写失败测试**

在 `tests/unit/young-event-service.test.ts`（先读现有测试的 prisma mock 方式）
增加：

```typescript
it("summary includes extended fields and drops registrationStatus", async () => {
  // mock findMany 返回带全部新列的记录
  const result = await listYoungEvents({});
  const event = result.data[0]!;
  expect(event.activityLevel).toBe("院级");
  expect(event.module).toBe("美");
  expect(event.contactTel).toBe("13800000000");
  expect(event.places).toEqual([
    { placeInfo: "东区礼堂", placeSt: "2026-08-20 14:00:00", placeEt: "2026-08-20 16:00:00" },
  ]);
  expect("registrationStatus" in event).toBe(false);
});

it("detail renders description/participationNotes through the HTML pipeline", async () => {
  // mock findUnique 返回 description 含 young 绝对图床 <img>
  const event = await getYoungEvent("ev1");
  expect(event?.description).toContain("/api/catalog/young-events/images/");
  expect(event?.rawJson).toBeDefined();
});

it("list filters by module and activityLevel", async () => {
  await listYoungEvents({ module: "美", activityLevel: "院级" });
  // 断言 prisma.youngEvent.findMany 收到的 where 含 module/activityLevel
});
```

- [ ] **Step 2: 运行确认失败** → `bunx vitest run tests/unit/young-event-service.test.ts`，FAIL。

- [ ] **Step 3: 实现**

`young-event-service.ts`：

- `YOUNG_EVENT_SELECT` 删除 `registrationStatus`，新增全部新列（`places: true` 等）。
- `toYoungEventSummary` 透传新标量；`places` 做运行时窄化：

```typescript
function toYoungEventPlaces(value: Prisma.JsonValue | null): YoungEventPlace[] | null {
  if (!Array.isArray(value)) return null;
  const places = value
    .filter((item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item) => ({
      placeInfo: typeof item.placeInfo === "string" ? item.placeInfo : null,
      placeSt: typeof item.placeSt === "string" ? item.placeSt : null,
      placeEt: typeof item.placeEt === "string" ? item.placeEt : null,
    }));
  return places.length > 0 ? places : null;
}
```

- `listYoungEvents` 的 where 增加：

```typescript
  const moduleFilter = input.module?.trim();
  if (moduleFilter) where.module = moduleFilter;
  const levelFilter = input.activityLevel?.trim();
  if (levelFilter) where.activityLevel = levelFilter;
```

- `getYoungEvent` 的 select 增加 `description: true, participationNotes: true`，
  返回前过 `renderYoungEventHtml`：

```typescript
  return {
    ...toYoungEventSummary(summaryRecord),
    description: description == null ? null : renderYoungEventHtml(description),
    participationNotes:
      participationNotes == null ? null : renderYoungEventHtml(participationNotes),
    rawJson,
  };
```

- [ ] **Step 4: 运行确认通过** → 同上，PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/young/server/young-event-service.ts tests/unit/young-event-service.test.ts
git commit -m "feat(young): expose extended fields from event service"
```

---

### Task 6: REST schemas/routes + 契约 + OpenAPI

**Files:**
- Modify: `src/lib/api/schemas/young-event-schemas.ts`
- Modify: `src/lib/api/routes/young-event-routes.ts`（list 透传新 query 参数）
- Modify: `docs/contracts/young-event.json`
- Regenerate: `public/openapi.generated.json`（经脚本，不手改）
- Test: 既有 OpenAPI/契约测试自动覆盖

**Interfaces:**
- Consumes: Task 5 的 `YoungEventListInput`/summary/detail 类型。
- Produces: REST query 新增 `module`、`activityLevel`；summary schema 为 Task 5
  全字段（无 `registrationStatus`、无 description/participationNotes）；detail
  schema = summary + `description`/`participationNotes`/`rawJson`。

- [ ] **Step 1: 改 `young-event-schemas.ts`**

- `youngEventsQuerySchema` 增加 `module`、`activityLevel`（与 `category` 同款
  `z.string().trim().min(1).max(100).optional()`，describe 分别写
  `Exact module filter, e.g. 德/智/体/美/劳.` 与
  `Exact activity-level filter, e.g. 院级 or 校级.`）。
- `youngEventSummarySchema` 删除 `registrationStatus`，新增（全部 `.nullable()`，
  数值类 `z.number()`、整数 `z.number().int()`、时间 `dateTimeSchema.nullable()`）：

```typescript
  activityLevel: z.string().nullable(),
  module: z.string().nullable(),
  form: z.string().nullable(),
  grades: z.string().nullable(),
  sponsor: z.string().nullable(),
  contactName: z.string().nullable(),
  contactTel: z.string().nullable(),
  duration: z.number().nullable(),
  serviceHour: z.number().nullable(),
  sumHours: z.number().nullable(),
  sumPersons: z.number().int().nullable(),
  partakeNum: z.number().int().nullable(),
  favCount: z.number().int().nullable(),
  limitNum: z.number().int().nullable(),
  createdAtUpstream: dateTimeSchema.nullable(),
  auditedAt: dateTimeSchema.nullable(),
  updatedAtUpstream: dateTimeSchema.nullable(),
  places: z
    .array(
      z.strictObject({
        placeInfo: z.string().nullable(),
        placeSt: z.string().nullable(),
        placeEt: z.string().nullable(),
      }),
    )
    .nullable(),
```

- `youngEventDetailSchema` 改为：

```typescript
export const youngEventDetailSchema = youngEventSummarySchema.extend({
  description: z.string().nullable(),
  participationNotes: z.string().nullable(),
  rawJson: z.unknown(),
});
```

- [ ] **Step 2: routes 透传**

`getYoungEventsRoute` 中 `listYoungEvents({...})` 增加
`module: query.module, activityLevel: query.activityLevel`。

- [ ] **Step 3: 更新 `docs/contracts/young-event.json`**

- `rules.raw-payload-preserved` 保留；新增 rule `rich-text-proxied`：
  正文 HTML 经消毒并把 young 图床图片改写为本地代理路径。
- REST list 的 `returns` 字段列表更新为新的 summary 全集；image 路由 notes
  补充新代理路由 `/api/catalog/young-events/images/[...path]`。
- display.fields 扩为完整展示清单（名称、类别、级别、模块、形式、时间、
  报名窗口、人数/学时、主办/承办/联系人/电话、场地、正文、须知等）。
- MCP notes 同步（compact 增加 module/activityLevel/form，删除
  registrationStatus 提及）。

- [ ] **Step 4: 验证**

Run: `bun run openapi:check`（若失败按其提示运行生成脚本更新
`public/openapi.generated.json` 后重跑）+ `bunx vitest run tests/unit/young-event`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/ docs/contracts/young-event.json public/openapi.generated.json
git commit -m "feat(api): expose young event extended fields over REST"
```

---

### Task 7: GraphQL 类型与筛选

**Files:**
- Modify: `src/lib/graphql/schema.ts`（`YoungEventFilter`、`type YoungEvent`、
  `youngEvents` resolver，约 201-230、357-358、618-640 行）
- Test: `tests/unit/graphql-schema-snapshot.test.ts`（快照更新）；young 相关
  resolver 测试（若存在）

**Interfaces:**
- Consumes: Task 5 类型。
- Produces: `YoungEventFilter` 增加 `module: String`、`activityLevel: String`；
  `type YoungEvent` 删除 `registrationStatus`，新增全部 summary 字段 +
  `description: String`、`participationNotes: String`、`places: [YoungEventPlace!]`、
  `rawJson: String`（JSON 序列化字符串——schema 只有 Date/DateTime 自定义
  scalar，不新增 JSON scalar）；新增 `type YoungEventPlace { placeInfo: String, placeSt: String, placeEt: String }`。

- [ ] **Step 1: 改 SDL**

```graphql
  input YoungEventFilter {
    active: Boolean
    category: String
    module: String
    activityLevel: String
    search: String
  }

  type YoungEventPlace {
    placeInfo: String
    placeSt: String
    placeEt: String
  }

  type YoungEvent {
    youngId: String!
    name: String!
    category: String
    department: String
    organizer: String
    status: String
    location: String
    imageUrl: String
    hours: Float
    capacity: Int
    appliedCount: Int
    startAt: DateTime
    endAt: DateTime
    applyStartAt: DateTime
    applyEndAt: DateTime
    isActive: Boolean!
    activityLevel: String
    module: String
    form: String
    grades: String
    sponsor: String
    contactName: String
    contactTel: String
    duration: Float
    serviceHour: Float
    sumHours: Float
    sumPersons: Int
    partakeNum: Int
    favCount: Int
    limitNum: Int
    createdAtUpstream: DateTime
    auditedAt: DateTime
    updatedAtUpstream: DateTime
    places: [YoungEventPlace!]
    description: String
    participationNotes: String
    rawJson: String
  }
```

- [ ] **Step 2: resolver**

`youngEvents` resolver 的 filter 透传增加
`module: validateGraphqlSearch(args.filter?.module)` 与
`activityLevel: validateGraphqlSearch(args.filter?.activityLevel)`。
`YoungEvent` 类型如需 field resolver：`rawJson: (parent) =>
parent.rawJson == null ? null : JSON.stringify(parent.rawJson)`（按 schema.ts
现有 field-resolver 注册方式加到对应 resolvers 对象；若 Yoga 默认透传不足以
序列化对象，则必须加）。

- [ ] **Step 3: 更新快照并验证**

Run: `bunx vitest run tests/unit/graphql-schema-snapshot.test.ts`（失败时按测试
说明更新快照文件）+ `bunx tsc --noEmit -p tsconfig.typecheck.json`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/lib/graphql/ tests/ docs/graphql/
git commit -m "feat(graphql): expose young event extended fields"
```

---

### Task 8: MCP 工具与输出 schema

**Files:**
- Modify: `src/lib/mcp/tools/catalog/young-event-tools.ts`
- Modify: `src/lib/mcp/compact-entities.ts`（`compactYoungEvent`）
- Modify: `src/lib/mcp/tool-output-schemas.ts`（740-767、1211-1218、1717 附近）
- Test: 相关 MCP 单测（`tests/unit/` 下 mcp 相关，含工具数/output schema 断言）

**Interfaces:**
- Consumes: Task 5 类型、Task 6 schema。
- Produces: `catalog_young_event_list` 新增 `module`/`activityLevel` 输入；
  compact 输出 = 原集合 − `registrationStatus` + `module`/`activityLevel`/`form`。

- [ ] **Step 1: 改 compact 与 output schemas**

`compactYoungEvent` 的 pick 列表：删 `registrationStatus`，在 `category` 后加
`"module", "activityLevel", "form"`。
`compactYoungEventSchema` 相应改为

```typescript
const compactYoungEventSchema = youngEventSummarySchema.omit({
  department: true,
  organizer: true,
  imageUrl: true,
  // 详情/长字段不进 compact：
  grades: true, sponsor: true, contactName: true, contactTel: true,
  duration: true, serviceHour: true, sumHours: true, sumPersons: true,
  partakeNum: true, favCount: true, limitNum: true,
  createdAtUpstream: true, auditedAt: true, updatedAtUpstream: true,
  places: true,
});
```

（default 列表保持轻量；full 模式自动获得全部新字段。）

- [ ] **Step 2: 工具输入**

`catalog_young_event_list` inputSchema 增加 `module`、`activityLevel`（与
`category` 同款 zod），`listYoungEventsTool` 透传。工具 description 补一句
新筛选能力。

- [ ] **Step 3: 验证**

Run: `bunx vitest run tests/unit` 中 mcp 相关文件（至少
`bunx vitest run tests/unit/mcp` 或按测试布局选择）
Expected: PASS（若有工具描述/schema 快照断言，同步更新）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/mcp/
git commit -m "feat(mcp): expose young event extended fields and filters"
```

---

### Task 9: Web 详情页分区展示

**Files:**
- Modify: `src/features/young/components/YoungEventDetailPage.svelte`
- Modify: `messages/zh-cn.json`、`messages/en-us.json`（`youngEvents` 节）
- Modify: `src/features/dashboard/server/dashboard-page-copy.ts` 的 copy 类型
  （若 youngEvents copy 有显式类型定义）

**Interfaces:**
- Consumes: Task 5 `YoungEventDetail`（load 已透传 `getYoungEvent` 结果，无需改
  `young-page-load.ts`）。
- Produces: 详情页分区 UI。

- [ ] **Step 1: i18n 键**

`youngEvents` 节新增（zh-cn / en-us 同步）：

```json
    "activityLevel": "活动级别",
    "module": "二课堂模块",
    "form": "参与形式",
    "grades": "面向年级",
    "sponsor": "主办单位",
    "contact": "联系方式",
    "duration": "持续时长",
    "durationUnit": "小时",
    "serviceHour": "志愿时长",
    "sumHours": "累计认定学时",
    "sumPersons": "累计人次",
    "partakeNum": "实际参与人数",
    "favCount": "收藏数",
    "limitNum": "名额上限",
    "createdAt": "创建时间",
    "auditedAt": "审核时间",
    "updatedAt": "更新时间",
    "sectionDescription": "活动介绍",
    "sectionTime": "时间与报名",
    "sectionPeople": "人数与学时",
    "sectionOrganization": "组织与联系",
    "sectionPlaces": "场地安排",
    "sectionNotes": "参与须知"
```

en-us 对应翻译（如 `"activityLevel": "Level"` 等，逐一给出）。

- [ ] **Step 2: 重写详情页**

结构（沿用现有 `PageLayout`/`Panel`/徽标样式，空值条目过滤逻辑保留）：

1. 标题 + 头图（现状保留）
2. 徽标行：`status`、`activityLevel`、`module`、`form`（用既有 Badge 组件，
   无则用 `text-xs` 圆角 span，参照列表/其他详情页的徽标写法）
3. `sectionDescription`：`{#if event.description}<Panel><div class="prose ...">{@html event.description}</div></Panel>{/if}`
   （prose 类参照项目中其他富文本展示处，如 news 详情；先 grep `prose` 找惯例）
4. `sectionTime` Panel：活动起止、报名窗口、createdAt/auditedAt/updatedAt
5. `sectionPeople` Panel：capacity+appliedCount、partakeNum、sumPersons、
   hours、serviceHour、duration（带 `durationUnit`）、sumHours、limitNum、favCount
6. `sectionOrganization` Panel：sponsor、organizer、department、
   contactName+contactTel（合并一行显示 `"张三 13800000000"`）
7. `sectionPlaces` Panel：`places` 列表（placeInfo + placeSt~placeEt）；
   无 places 时回退显示 `location`（现有行为并入此区）
8. `sectionNotes` Panel：`participationNotes` 同 description 渲染
9. 保留 signupHint / signupCta / backToList

`grades` 展示为原值（如 `1,2,3,4,5,6`），放入 sectionPeople 或头部信息行。

- [ ] **Step 3: 验证**

Run: `bunx svelte-check --tsconfig ./tsconfig.json` + `bunx biome check` +
dev 服务器手动看一眼详情页（`bun run dev`，用本地库 2556 条真实数据，
访问 `/catalog/young-events/<一个真实 youngId>`，确认分区渲染、图片走代理）
Expected: 无类型/lint 错误；页面分区正常、正文图片加载。

- [ ] **Step 4: Commit**

```bash
git add src/features/young/components/YoungEventDetailPage.svelte messages/ src/features/dashboard/
git commit -m "feat(web): render young event detail sections"
```

---

### Task 10: Web 列表页筛选与徽标

**Files:**
- Modify: `src/features/young/server/young-page-load.ts`
- Modify: `src/features/young/components/YoungEventsPage.svelte`
- Modify: `messages/zh-cn.json`、`messages/en-us.json`

**Interfaces:**
- Consumes: Task 5 的 `module`/`activityLevel` 筛选输入。
- Produces: `YoungEventsPageFilters` 增加 `module?: string; activityLevel?: string`；
  列表页两个新下拉与徽标。

- [ ] **Step 1: load 层**

`loadYoungEventsPage`：`filters` 增加
`module: optionalValue(url.searchParams.get("module"))`、
`activityLevel: optionalValue(url.searchParams.get("activityLevel"))`，透传给
`listYoungEvents`。

- [ ] **Step 2: 列表页**

- 筛选表单增加两个 `NativeSelect`（固定枚举）：
  module 选项 `德/智/体/美/劳`；activityLevel 选项 `班级/院级/校级/省级/国家级`，
  均带"全部"空值项（复用现有 `allCategories` 模式，新增 i18n 键
  `allModules`/`allActivityLevels`）。
- 桌面表格：`registrationStatus` 列替换为 `module` 列；移动端 footer 的
  `registrationStatus` 替换为 `module ?? "-"`，并追加 `activityLevel`。
- 保留其余列不动。

- [ ] **Step 3: i18n**

新增 `"module"`、`"activityLevel"`、`"allModules"`（全部模块）、
`"allActivityLevels"`（全部级别）（若 Task 9 已加 module/activityLevel 键则
复用，仅补 all* 键）。删除 `registrationStatus` 键。

- [ ] **Step 4: 验证**

Run: `bunx svelte-check --tsconfig ./tsconfig.json` + `bunx biome check`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/young/ messages/
git commit -m "feat(web): filter young events by module and activity level"
```

---

### Task 11: 全量验证与文档收尾

- [ ] **Step 1: 默认检查套件全跑**

```bash
bun run app:prepare
bunx wrangler types --include-runtime=false --check
bunx biome check
bunx svelte-check --tsconfig ./tsconfig.json
bunx tsc --noEmit -p tsconfig.typecheck.json
bunx tsc --noEmit -p tsconfig.typecheck.tests.json
bunx tsc --noEmit -p tsconfig.typecheck.operational.json
bunx vitest run
bun run openapi:check
bunx vitest run tests/unit/graphql-schema-snapshot.test.ts
```

- [ ] **Step 2: 集成测试**

```bash
bun run db:migrate:deploy && bunx prisma db seed
bunx vitest run --config vitest.integration.config.ts
```

- [ ] **Step 3: 真实数据端到端核对**

用本地独立开发库（compose 项目端口 55433，**不碰 5432 主库**）跑一次
static loader 导入真实快照（`static/build/life-ustc-static.sqlite`），
`bun run dev` 后 curl 验证：

```bash
curl -s "http://127.0.0.1:3000/api/catalog/young-events?pageSize=1" | jq '.data[0] | keys'
curl -s "http://127.0.0.1:3000/api/catalog/young-events/<youngId>" | jq '{description, places, contactTel}'
```

确认新字段有真实值、description 中图片已改写、列表无 `registrationStatus`。

- [ ] **Step 4: 文档核对**

- `docs/contracts/young-event.json` 已在 Task 6 更新，复核一遍与实现一致。
- 若 `docs/interface-hierarchy.md` 提到 young events 字段，同步更新。
- 检查是否有 AGENTS.md 条目因本次变更过期（如 young feature 相关说明），按
  根 AGENTS.md 要求更新。

- [ ] **Step 5: Commit + 推分支开 PR**

```bash
git commit -am "chore(young): final verification sweep"  # 仅在有改动时
git push -u origin feat/young-event-full-fields
gh pr create --fill
```

开 PR 后按用户惯例：检查 CI（GitHub Actions）至完成，失败则修复。
