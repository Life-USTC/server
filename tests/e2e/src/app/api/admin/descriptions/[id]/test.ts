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

test.describe("PATCH /api/admin/descriptions/[id]", () => {
  test("api contract", async ({ request }) => {
    await assertApiContract(request, { routePath: `${BASE}/[id]` });
  });

  test("unauthenticated PATCH returns 401", async ({ request }) => {
    const response = await request.patch(`${BASE}/missing-id`, {
      data: { content: "should fail" },
    });
    expect(response.status()).toBe(401);
  });

  test("non-admin PATCH returns 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.patch(`${BASE}/missing-id`, {
      data: { content: "should fail" },
    });
    expect(response.status()).toBe(401);
  });

  test("admin can update and restore a description", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const listResponse = await page.request.get(`${BASE}?limit=1`);
    expect(listResponse.status()).toBe(200);
    const description = (
      (await listResponse.json()) as {
        descriptions?: Array<{ content?: string; id?: string }>;
      }
    ).descriptions?.[0];
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

  test("admin PATCH rejects overlong description content", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const listResponse = await page.request.get(`${BASE}?limit=1`);
    expect(listResponse.status()).toBe(200);
    const description = (
      (await listResponse.json()) as {
        descriptions?: Array<{ id?: string }>;
      }
    ).descriptions?.[0];
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
