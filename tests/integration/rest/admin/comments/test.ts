/**
 * E2E tests for GET /api/admin/comments
 *
 * Admin-only endpoint listing comments for moderation.
 *
 * - GET returns `{ data: [...], pagination }` with detailed includes (user, section, course, etc.)
 * - Supports `status` filter: "active", "softbanned", "deleted", "suspended"
 *   - "suspended" filters by users with active suspensions
 * - Supports `page` and `pageSize` parameters; retired `limit` is rejected
 * - Comments are ordered by createdAt descending
 * - Returns 401 for unauthenticated or non-admin requests
 */
import { expect } from "@playwright/test";
import { assertApiContract } from "../../_shared/api-contract";
import { base as BASE, test } from "./_fixture";

test.describe("GET /api/admin/comments 评论列表", () => {
  test("API 契约", async ({ run, request }) => {
    await run(async () => {
      await assertApiContract(request, { routePath: BASE });
    });
  });

  test("未认证请求返回 401", async ({ run, request }) => {
    await run(async () => {
      const response = await request.get(BASE);
      expect(response.status()).toBe(401);
    });
  });

  test("非管理员认证用户返回 401", async ({ run, commentState }) => {
    await run(async () => {
      const { owner, db } = commentState;
      const response = await owner.request.get(BASE);
      expect(response.status()).toBe(401);
      expect(await db.auditLog.count()).toBe(0);
    });
  });

  test("管理员可按 status=softbanned 筛选评论", async ({
    run,
    commentState,
  }) => {
    await run(async () => {
      const { admin, softbanned } = commentState;
      const response = await admin.request.get(`${BASE}?status=softbanned`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.map((item: { id: string }) => item.id)).toEqual([
        softbanned.id,
      ]);
      expect(
        body.data.every(
          (item: { status: string }) => item.status === "softbanned",
        ),
      ).toBe(true);
      expect(body.pagination.total).toBe(1);
    });
  });

  test("管理员可无状态筛选列出活跃评论", async ({ run, commentState }) => {
    await run(async () => {
      const { admin, owner, db, recent, older } = commentState;
      const response = await admin.request.get(`${BASE}?pageSize=5`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.map((item: { id: string }) => item.id)).toEqual([
        recent.id,
        older.id,
      ]);
      expect(body.data.length).toBeLessThanOrEqual(5);
      expect(
        body.data.every((item: { status: string }) => item.status === "active"),
      ).toBe(true);
      expect(body.pagination).toMatchObject({ page: 1, pageSize: 5, total: 2 });
      // The anonymous author's identity is returned only after its read audit commits.
      expect(body.data[0]).toMatchObject({
        userId: owner.id,
        isAnonymous: true,
      });
      expect(await db.auditLog.findMany()).toEqual([
        expect.objectContaining({
          action: "admin_comment_identity_reveal",
          userId: admin.id,
          channel: "rest",
          targetType: "comment",
          targetId: recent.id,
        }),
      ]);
    });
  });

  test("管理员可翻到第二页且不会重复第一条评论", async ({
    run,
    commentState,
  }) => {
    await run(async () => {
      const { admin, recent, older } = commentState;
      const firstResponse = await admin.request.get(
        `${BASE}?page=1&pageSize=1`,
      );
      const secondResponse = await admin.request.get(
        `${BASE}?page=2&pageSize=1`,
      );
      expect(firstResponse.status()).toBe(200);
      expect(secondResponse.status()).toBe(200);
      const first = await firstResponse.json();
      const second = await secondResponse.json();
      expect(first.pagination).toMatchObject({
        page: 1,
        pageSize: 1,
        total: 2,
      });
      expect(second.pagination).toMatchObject({
        page: 2,
        pageSize: 1,
        total: first.pagination.total,
      });
      expect(first.data.map((item: { id: string }) => item.id)).toEqual([
        recent.id,
      ]);
      expect(second.data.map((item: { id: string }) => item.id)).toEqual([
        older.id,
      ]);
      expect(second.data[0].id).not.toBe(first.data[0].id);
    });
  });
});
