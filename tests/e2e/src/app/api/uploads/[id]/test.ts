/**
 * E2E tests for PATCH /api/uploads/[id] and DELETE /api/uploads/[id].
 *
 * ## PATCH /api/uploads/[id]
 * - Body: { filename }
 * - Response: { upload: { id, key, filename, size, createdAt } }
 * - Auth required (401) + ownership check (404 if not owner)
 * - Returns 400 for empty filename
 *
 * ## DELETE /api/uploads/[id]
 * - Response: { deletedId, deletedSize }
 * - Auth required (401) + ownership check (404 if not owner)
 * - Deletes object from R2 then removes DB record
 *
 * ## Edge cases
 * - Renamed filename reflects in subsequent download
 * - Deleted upload no longer appears in GET /api/uploads
 * - Non-existent id on DELETE → 404
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { createUploadedFileViaApi } from "../../../../../utils/uploads";
import { assertApiContract } from "../../../_shared/api-contract";

test("/api/uploads/[id]", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/uploads/[id]" });
});

test("/api/uploads/[id] PATCH 未登录返回 401", async ({ request }) => {
  const response = await request.patch("/api/uploads/invalid-e2e", {
    data: { filename: "should-fail.txt" },
  });
  expect(response.status()).toBe(401);
});

test("/api/uploads/[id] PATCH 可重命名上传文件", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsDebugUser(page, "/");

  const filename = `e2e-api-upload-${Date.now()}.txt`;
  const renamedFilename = `renamed-${filename}`;
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename,
    contents: "rename test content",
  });

  try {
    const renameResponse = await page.request.patch(
      `/api/uploads/${uploaded.uploadId}`,
      { data: { filename: renamedFilename } },
    );
    expect(renameResponse.status()).toBe(200);
    const renameBody = (await renameResponse.json()) as {
      upload?: { id?: string; filename?: string };
    };
    expect(renameBody.upload?.filename).toBe(renamedFilename);
    expect(renameBody.upload?.id).toBe(uploaded.uploadId);

    // Verify the download uses the new filename
    const downloadResponse = await page.request.get(
      `/api/uploads/${uploaded.uploadId}/download`,
    );
    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()["content-disposition"]).toContain(
      renamedFilename,
    );
  } finally {
    await page.request.delete(`/api/uploads/${uploaded.uploadId}`);
  }
});

test("/api/uploads/[id] DELETE 未登录返回 401", async ({ request }) => {
  const response = await request.delete("/api/uploads/invalid-e2e");
  expect(response.status()).toBe(401);
});

test("/api/uploads/[id] DELETE 可删除上传文件并返回大小", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsDebugUser(page, "/");

  const filename = `e2e-api-upload-delete-${Date.now()}.txt`;
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename,
    contents: "delete test content",
  });

  const deleteResponse = await page.request.delete(
    `/api/uploads/${uploaded.uploadId}`,
  );
  expect(deleteResponse.status()).toBe(200);
  const deleteBody = (await deleteResponse.json()) as {
    deletedId?: string;
    deletedSize?: number;
  };
  expect(deleteBody.deletedId).toBe(uploaded.uploadId);
  expect(typeof deleteBody.deletedSize).toBe("number");

  // Verify file no longer appears in uploads list
  const listResponse = await page.request.get("/api/uploads");
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    data?: Array<{ id?: string }>;
  };
  expect(listBody.data?.some((u) => u.id === uploaded.uploadId)).toBe(false);
});

test("/api/uploads/[id] DELETE 不存在的 id 返回 404", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const response = await page.request.delete(
    "/api/uploads/00000000-0000-0000-0000-000000000000",
  );
  expect(response.status()).toBe(404);
});
