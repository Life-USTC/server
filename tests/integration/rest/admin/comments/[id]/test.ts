/**
 * E2E tests for PATCH /api/admin/comments/[id]
 *
 * Admin-only endpoint to moderate a single comment.
 *
 * - PATCH body requires `status` ("active" | "softbanned" | "deleted")
 *   and optional `moderationNote`
 * - Sets moderatedAt, moderatedById on the comment
 * - When status="deleted", also sets deletedAt; otherwise clears it
 * - Returns the updated comment in `{ comment: {...} }`
 * - Returns 401 for unauthenticated or non-admin requests
 * - Returns 400 for missing/invalid body (e.g. empty object)
 */
import { expect } from "@playwright/test";
import { assertApiContract } from "../../../_shared/api-contract";
import { base as BASE, test } from "../_fixture";

test.describe("PATCH /api/admin/comments/[id] 评论管理", () => {
  test("API 契约", async ({ run, request }) => {
    await run(async () => {
      await assertApiContract(request, { routePath: `${BASE}/[id]` });
    });
  });

  test("未认证 PATCH 返回 401", async ({ run, request }) => {
    await run(async () => {
      const response = await request.patch(`${BASE}/nonexistent-id`, {
        data: { status: "softbanned" },
      });
      expect(response.status()).toBe(401);
    });
  });

  test("非管理员 PATCH 返回 401", async ({ run, commentState }) => {
    await run(async () => {
      const { owner, db, recent } = commentState;
      const response = await owner.request.patch(`${BASE}/${recent.id}`, {
        data: { status: "softbanned" },
      });
      expect(response.status()).toBe(401);
      expect(
        await db.comment.findUniqueOrThrow({ where: { id: recent.id } }),
      ).toEqual(recent);
      expect(await db.auditLog.count()).toBe(0);
    });
  });

  test("空请求体返回 400", async ({ run, commentState }) => {
    await run(async () => {
      const { admin, db, recent } = commentState;
      const response = await admin.request.patch(`${BASE}/${recent.id}`, {
        data: {},
      });
      expect(response.status()).toBe(400);
      expect(
        await db.comment.findUniqueOrThrow({ where: { id: recent.id } }),
      ).toEqual(recent);
      expect(await db.auditLog.count()).toBe(0);
    });
  });

  test("管理员可管理评论并恢复状态", async ({ run, commentState }) => {
    await run(async () => {
      const { admin, owner, db, recent } = commentState;
      const others = await db.comment.findMany({
        where: { id: { not: recent.id } },
        orderBy: { id: "asc" },
      });
      const softbanResponse = await admin.request.patch(
        `${BASE}/${recent.id}`,
        {
          data: { status: "softbanned", moderationNote: "e2e moderation test" },
        },
      );
      expect(softbanResponse.status()).toBe(200);
      const softbanBody = await softbanResponse.json();
      expect(softbanBody.comment).toMatchObject({
        id: recent.id,
        status: "softbanned",
        moderationNote: "e2e moderation test",
        moderatedById: admin.id,
        deletedAt: null,
      });
      expect(softbanBody.comment.moderatedAt).toBeTruthy();
      const moderated = await db.comment.findUniqueOrThrow({
        where: { id: recent.id },
      });
      expect(moderated).toMatchObject({
        status: "softbanned",
        moderationNote: "e2e moderation test",
        moderatedById: admin.id,
        moderatedAt: expect.any(Date),
        deletedAt: null,
      });
      expect(moderated.moderatedAt?.toISOString()).toBe(
        new Date(softbanBody.comment.moderatedAt).toISOString(),
      );
      const auditWhere = {
        action: "admin_comment_moderate" as const,
        targetId: recent.id,
      };
      expect(await db.auditLog.findMany({ where: auditWhere })).toEqual([
        expect.objectContaining({
          userId: admin.id,
          subjectUserId: owner.id,
          channel: "rest",
          targetType: "comment",
          metadata: { status: "softbanned", moderationNoteProvided: true },
        }),
      ]);

      // Restore is a second operation under test, not cleanup of a shared record.
      const restore = await admin.request.patch(`${BASE}/${recent.id}`, {
        data: { status: "active" },
      });
      expect(restore.status()).toBe(200);
      expect((await restore.json()).comment).toMatchObject({
        id: recent.id,
        status: "active",
        moderationNote: null,
      });
      expect(
        await db.comment.findUniqueOrThrow({ where: { id: recent.id } }),
      ).toMatchObject({
        status: "active",
        moderationNote: null,
        moderatedById: admin.id,
        deletedAt: null,
      });
      const audits = await db.auditLog.findMany({ where: auditWhere });
      expect(audits).toHaveLength(2);
      expect(audits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: admin.id,
            subjectUserId: owner.id,
            channel: "rest",
            metadata: { status: "active", moderationNoteProvided: false },
          }),
        ]),
      );
      expect(
        await db.comment.findMany({
          where: { id: { not: recent.id } },
          orderBy: { id: "asc" },
        }),
      ).toEqual(others);
    });
  });
});
