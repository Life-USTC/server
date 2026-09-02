/**
 * E2E tests for GET /api/catalog/young-events
 *
 * ## Endpoints
 * - `GET /api/catalog/young-events` — List second-classroom signup events with
 *   optional `active`, `category`, `search`, `page`/`pageSize` (and deprecated
 *   `limit` alias) filters.
 * - `GET /api/catalog/young-events/[youngId]` — Fetch one event by its
 *   young.ustc.edu.cn identifier.
 * - `GET /api/catalog/young-events/[youngId]/image` — Poster image proxy backed
 *   by an R2 cache; only deterministic error cases are covered here because a
 *   cache miss fetches the live young.ustc.edu.cn origin.
 *
 * ## Response
 * - 200 list: `{ data: YoungEventSummary[], pagination: { page, pageSize, total, totalPages } }`
 * - 200 detail: `YoungEventDetail` (summary fields + `rawJson`); `imageUrl` is
 *   the local proxy path `/api/catalog/young-events/[youngId]/image` or null
 * - 400: `{ error: string }` on invalid query
 * - 404: `{ error: string }` on unknown youngId
 *
 * ## Auth Requirements
 * - Public (no authentication required)
 *
 * ## Edge Cases
 * - The dev seed includes one active and one ended event
 *   (`DEV_SEED.youngEvent`), so search and filter assertions are deterministic.
 * - The active seed event stores a poster pic path; the ended seed event has
 *   none, so image 404s are deterministic.
 * - `totalPages` is always >= 1, even when total is 0
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import { assertApiContract } from "../_shared/api-contract";

test.describe("GET /api/catalog/young-events 接口", () => {
  test("接口契约", async ({ request }) => {
    await assertApiContract(request, {
      routePath: "/api/catalog/young-events",
    });
  });

  test("详情接口契约", async ({ request }) => {
    await assertApiContract(request, {
      routePath: "/api/catalog/young-events/[youngId]",
    });
  });

  test("返回分页响应结构与公开缓存头", async ({ request }) => {
    const response = await request.get("/api/catalog/young-events");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe(
      "public, max-age=0, stale-while-revalidate=300",
    );
    expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
      "public, max-age=86400, stale-while-revalidate=300",
    );
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.pagination?.page).toBe("number");
    expect(typeof body.pagination?.pageSize).toBe("number");
    expect(typeof body.pagination?.total).toBe("number");
    expect(body.pagination?.totalPages).toBeGreaterThanOrEqual(1);
  });

  test("active 筛选只返回报名中的活动", async ({ request }) => {
    const response = await request.get("/api/catalog/young-events?active=true");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ isActive?: boolean }>;
    };
    expect(body.data?.every((event) => event.isActive === true)).toBe(true);
  });

  test("不匹配的搜索返回空数组而不是错误", async ({ request }) => {
    const response = await request.get(
      `/api/catalog/young-events?search=${encodeURIComponent("e2e-不可能存在的活动名称")}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data?: unknown[] };
    expect(body.data).toEqual([]);
  });

  test("非法 active 参数返回 400", async ({ request }) => {
    const response = await request.get(
      "/api/catalog/young-events?active=maybe",
    );
    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });

  test("未知 youngId 返回 404", async ({ request }) => {
    const response = await request.get(
      "/api/catalog/young-events/e2e-unknown-young-id",
    );
    expect(response.status()).toBe(404);
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });

  test("详情 imageUrl 指向本地缓存代理路径", async ({ request }) => {
    const response = await request.get(
      `/api/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { imageUrl?: string | null };
    expect(body.imageUrl).toBe(
      `/api/catalog/young-events/${DEV_SEED.youngEvent.youngId}/image`,
    );
  });

  test("未知 youngId 的海报返回 404", async ({ request }) => {
    const response = await request.get(
      "/api/catalog/young-events/e2e-unknown-young-id/image",
    );
    expect(response.status()).toBe(404);
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });

  test("无海报的已结束活动返回 404", async ({ request }) => {
    const response = await request.get(
      "/api/catalog/young-events/dev-scenario-young-event-ended/image",
    );
    expect(response.status()).toBe(404);
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });
});
