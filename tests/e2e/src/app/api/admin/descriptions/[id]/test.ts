/**
 * E2E tests for PATCH /api/admin/descriptions/[id].
 *
 * Admin-only endpoint to update description content from moderation surfaces.
 * It shares the same service as the /admin/moderation description action and
 * records description edit/audit history.
 */
import { expect, test } from "@playwright/test";
import { DESCRIPTION_CONTENT_MAX_LENGTH } from "@/features/descriptions/lib/description-limits";
import {
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../../../utils/auth";
import {
  restoreDescriptionSnapshot,
  snapshotDescriptionForE2e,
  waitForDescriptionAuditRows,
} from "../../../../../../utils/description-state";
import { assertApiContract } from "../../../../_shared/api-contract";

const BASE = "/api/admin/descriptions";

test.describe("PATCH /api/admin/descriptions/[id] 课程简介管理", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: `${BASE}/[id]` });
  });

  test("未认证 PATCH 返回 401", async ({ request }) => {
    const response = await request.patch(`${BASE}/missing-id`, {
      data: { content: "should fail" },
    });
    expect(response.status()).toBe(401);
  });

  test("非管理员 PATCH 返回 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.patch(`${BASE}/missing-id`, {
      data: { content: "should fail" },
    });
    expect(response.status()).toBe(401);
  });

  test("管理员可更新并恢复课程简介", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const listResponse = await page.request.get(`${BASE}?limit=1`);
    expect(listResponse.status()).toBe(200);
    const description = (
      (await listResponse.json()) as {
        data?: Array<{ content?: string; id?: string }>;
      }
    ).data?.[0];
    expect(description?.id).toBeTruthy();
    if (!description?.id) {
      throw new Error("Expected description id");
    }

    const nextContent = `e2e-admin-description-${Date.now()}`;
    const snapshot = await snapshotDescriptionForE2e(description.id, [
      "admin_description_moderate",
    ]);

    try {
      const response = await page.request.patch(`${BASE}/${description.id}`, {
        data: { content: nextContent },
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        description?: {
          content?: string;
          id?: string;
          lastEditedById?: string | null;
        };
      };
      expect(body.description?.id).toBe(description.id);
      expect(body.description?.content).toBe(nextContent);
      expect(body.description?.lastEditedById).toBeTruthy();
    } finally {
      await waitForDescriptionAuditRows(snapshot, 1);
      await restoreDescriptionSnapshot(snapshot);
    }
  });

  test("管理员 PATCH 拒绝过长的课程简介内容", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const listResponse = await page.request.get(`${BASE}?limit=1`);
    expect(listResponse.status()).toBe(200);
    const description = (
      (await listResponse.json()) as {
        data?: Array<{ id?: string }>;
      }
    ).data?.[0];
    expect(description?.id).toBeTruthy();
    if (!description?.id) {
      throw new Error("Expected description id");
    }

    const response = await page.request.patch(`${BASE}/${description.id}`, {
      data: { content: "x".repeat(DESCRIPTION_CONTENT_MAX_LENGTH + 1) },
    });
    expect(response.status()).toBe(400);
  });
});
