/**
 * E2E tests for DELETE /api/admin/homeworks/[id]
 *
 * Admin-only endpoint to soft-delete a single homework.
 *
 * - DELETE returns `{ success: true }` on success
 * - Returns 401 for unauthenticated or non-admin requests
 * - Returns 404 when the homework id does not exist
 * - Soft-deletes the homework and records an audit log entry (action: "deleted")
 */
import { expect, test } from "@playwright/test";
import { resolveSeedSectionId } from "../../../../../e2e/utils/seed-lookups";
import { assertApiContract } from "../../../_shared/api-contract";
import { signInAsDebugUserApi, signInAsDevAdminApi } from "../../../_harness/auth";

const BASE = "/api/admin/homeworks";

test.describe("DELETE /api/admin/homeworks/[id] 作业管理", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: `${BASE}/[id]` });
  });

  test("未认证 DELETE 返回 401", async ({ request }) => {
    const response = await request.delete(`${BASE}/nonexistent-id`);
    expect(response.status()).toBe(401);
  });

  test("非管理员 DELETE 返回 401", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");
    const response = await request.delete(`${BASE}/nonexistent-id`);
    expect(response.status()).toBe(401);
  });

  test("管理员删除不存在的作业返回 404", async ({ request }) => {
    await signInAsDevAdminApi(request, "/admin");
    const response = await request.delete(
      `${BASE}/nonexistent-homework-id`,
    );
    expect(response.status()).toBe(404);
  });

  test("管理员可删除作业", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");
    const sectionId = await resolveSeedSectionId(request);

    const title = `e2e-admin-homework-delete-${Date.now()}`;
    const now = new Date();
    const createResponse = await request.post(
      "/api/community/section-homeworks",
      {
        data: {
          title,
          sectionId: String(sectionId),
          publishedAt: now.toISOString(),
          submissionStartAt: now.toISOString(),
          submissionDueAt: new Date(now.getTime() + 86400000).toISOString(),
        },
      },
    );
    expect(createResponse.status()).toBe(201);
    const createBody = (await createResponse.json()) as {
      id?: string;
    };
    const homeworkId = createBody.id;
    expect(homeworkId).toBeTruthy();
    if (!homeworkId) {
      throw new Error("Expected created homework id");
    }

    try {
      await signInAsDevAdminApi(request, "/admin");

      const deleteResponse = await request.delete(`${BASE}/${homeworkId}`);
      expect(deleteResponse.status()).toBe(200);
      const deleteBody = (await deleteResponse.json()) as {
        success?: boolean;
      };
      expect(deleteBody.success).toBe(true);

      // Verify the homework no longer appears in the public list.
      await signInAsDebugUserApi(request, "/");
      const listResponse = await request.get(
        `/api/community/section-homeworks?sectionId=${sectionId}`,
      );
      expect(listResponse.status()).toBe(200);
      const listBody = (await listResponse.json()) as {
        homeworks?: Array<{ id?: string; title?: string }>;
      };
      expect(listBody.homeworks?.some((item) => item.id === homeworkId)).toBe(
        false,
      );
    } finally {
      // Best-effort cleanup if the test failed before deletion.
      await signInAsDevAdminApi(request, "/admin");
      await request.delete(`${BASE}/${homeworkId}`);
    }
  });
});
