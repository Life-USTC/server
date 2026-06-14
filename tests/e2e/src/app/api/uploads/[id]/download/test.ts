/**
 * E2E tests for GET /api/uploads/[id]/download.
 *
 * ## GET /api/uploads/[id]/download
 * - Response: 200 streamed from R2
 * - Auth required (401 if unauthenticated)
 * - Ownership check: returns 404 if upload belongs to another user
 * - Sets Content-Disposition header with filename
 *
 * ## Edge cases
 * - Non-owner gets 404 (not 403, to avoid leaking upload existence)
 * - Non-existent upload id → 404
 * - Unauthenticated → 401
 */
import { expect, test } from "@playwright/test";
import {
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../../../utils/auth";
import { createUploadedFileViaApi } from "../../../../../../utils/uploads";
import { assertApiContract } from "../../../../_shared/api-contract";

test("/api/uploads/[id]/download", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/uploads/[id]/download",
  });
});

test("/api/uploads/[id]/download GET 未登录返回 401", async ({ request }) => {
  const response = await request.get("/api/uploads/invalid-e2e/download");
  expect(response.status()).toBe(401);
});

test("/api/uploads/[id]/download GET 可下载自己的文件", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsDebugUser(page, "/");

  const filename = `e2e-download-${Date.now()}.txt`;
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename,
    contents: "download test content",
  });

  try {
    const downloadResponse = await page.request.get(
      `/api/uploads/${uploaded.uploadId}/download`,
    );
    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()["content-disposition"]).toContain(
      filename,
    );
  } finally {
    await page.request.delete(`/api/uploads/${uploaded.uploadId}`);
  }
});

test("/api/uploads/[id]/download GET 非本人返回 404", async ({ browser }) => {
  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();

  try {
    await signInAsDebugUser(userPage, "/");

    // Create a file as debug user
    const filename = `e2e-download-nonowner-${Date.now()}.txt`;
    const uploaded = await createUploadedFileViaApi(userPage.request, {
      filename,
      contents: "non-owner download test",
    });

    try {
      // Try to download as admin user
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();

      try {
        await signInAsDevAdmin(adminPage, "/");
        const downloadResponse = await adminPage.request.get(
          `/api/uploads/${uploaded.uploadId}/download`,
          { maxRedirects: 0 },
        );
        expect(downloadResponse.status()).toBe(404);
      } finally {
        await adminContext.close();
      }
    } finally {
      await userPage.request.delete(`/api/uploads/${uploaded.uploadId}`);
    }
  } finally {
    await userContext.close();
  }
});

test("/api/uploads/[id]/download GET 不存在的 id 返回 404", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const response = await page.request.get(
    "/api/uploads/00000000-0000-0000-0000-000000000000/download",
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(404);
});
