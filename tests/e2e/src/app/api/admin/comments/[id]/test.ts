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
import { expect, test } from "@playwright/test";
import {
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../../../utils/auth";
import { assertApiContract } from "../../../../_shared/api-contract";

const BASE = "/api/admin/comments";

test.describe("PATCH /api/admin/comments/[id] 评论管理", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: `${BASE}/[id]` });
  });

  test("未认证 PATCH 返回 401", async ({ request }) => {
    const response = await request.patch(`${BASE}/nonexistent-id`, {
      data: { status: "softbanned" },
    });
    expect(response.status()).toBe(401);
  });

  test("非管理员 PATCH 返回 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.patch(`${BASE}/nonexistent-id`, {
      data: { status: "softbanned" },
    });
    expect(response.status()).toBe(401);
  });

  test("空请求体返回 400", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const listResponse = await page.request.get(`${BASE}?limit=1`);
    expect(listResponse.status()).toBe(200);
    const commentId = (
      (await listResponse.json()) as {
        data?: Array<{ id?: string }>;
      }
    ).data?.[0]?.id;
    expect(commentId).toBeTruthy();

    const response = await page.request.patch(`${BASE}/${commentId}`, {
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test("管理员可管理评论并恢复状态", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    // Find an active comment to moderate.
    const listResponse = await page.request.get(
      `${BASE}?status=active&limit=1`,
    );
    expect(listResponse.status()).toBe(200);
    const comment = (
      (await listResponse.json()) as {
        data?: Array<{ id?: string; status?: string }>;
      }
    ).data?.[0];
    expect(comment?.id).toBeTruthy();

    const commentId = comment?.id as string;
    const originalStatus = comment?.status ?? "active";

    try {
      // Softban the comment.
      const softbanResponse = await page.request.patch(`${BASE}/${commentId}`, {
        data: { status: "softbanned", moderationNote: "e2e moderation test" },
      });
      expect(softbanResponse.status()).toBe(200);
      const softbanBody = (await softbanResponse.json()) as {
        comment?: {
          id?: string;
          status?: string;
          moderatedAt?: string | null;
          moderatedById?: string | null;
        };
      };
      expect(softbanBody.comment?.status).toBe("softbanned");
      expect(softbanBody.comment?.moderatedAt).toBeTruthy();
      expect(softbanBody.comment?.moderatedById).toBeTruthy();
    } finally {
      // Restore the comment to its original status.
      await page.request.patch(`${BASE}/${commentId}`, {
        data: { status: originalStatus },
      });
    }
  });
});
