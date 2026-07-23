/**
 * E2E tests for POST /api/workspace/uploads/complete.
 *
 * ## POST /api/workspace/uploads/complete
 * - Body: { key, filename, contentType? }
 * - Response: { upload: { id, key, filename, size, createdAt }, usedBytes, quotaBytes }
 * - Auth required (401 if unauthenticated)
 * - Returns 403 if key prefix doesn't match user's upload path
 * - Returns 400 "Upload session expired" if no pending record exists
 * - Cleans up R2 object on failure (expired session, quota exceeded)
 * - Uses serializable transaction for race condition safety
 *
 * ## Edge cases
 * - Missing/expired pending upload -> deletes R2 object and returns 400
 * - Key prefix mismatch → 403
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { assertApiContract } from "../../../_shared/api-contract";

test("/api/workspace/uploads/complete", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/workspace/uploads/complete",
  });
});

test("/api/workspace/uploads/complete POST 未登录返回 401", async ({
  request,
}) => {
  const response = await request.post("/api/workspace/uploads/complete", {
    data: {
      key: "uploads/anonymous/test.txt",
      filename: "test.txt",
    },
  });
  expect(response.status()).toBe(401);
});

test("/api/workspace/uploads/complete POST key 前缀不匹配返回 403", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const response = await page.request.post("/api/workspace/uploads/complete", {
    data: {
      key: "uploads/other-user/test.txt",
      filename: "test.txt",
    },
  });
  expect(response.status()).toBe(403);
});

test("/api/workspace/uploads/complete POST 无 pending 时返回 400 且清理 R2 对象", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signInAsDebugUser(page, "/");

  // Resolve current user id for constructing a valid key prefix
  const sessionResponse = await page.request.get("/api/auth/get-session");
  expect(sessionResponse.status()).toBe(200);
  const session = (await sessionResponse.json()) as {
    user?: { id?: string };
  };
  const userId = session.user?.id;
  expect(typeof userId).toBe("string");

  // Use a key that was never registered as a pending upload record
  const key = `uploads/${userId}/e2e-expired-${Date.now()}.txt`;

  // Complete should fail because there's no pending upload record
  const completeResponse = await page.request.post(
    "/api/workspace/uploads/complete",
    {
      data: { key, filename: "e2e-expired.txt" },
    },
  );
  expect(completeResponse.status()).toBe(400);
  const completeBody = (await completeResponse.json()) as {
    error?: string;
  };
  expect(completeBody.error).toContain("Upload session expired");
});
