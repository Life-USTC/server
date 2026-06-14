/**
 * E2E tests for GET /api/uploads and POST /api/uploads.
 *
 * ## GET /api/uploads
 * - Response: { maxFileSizeBytes, quotaBytes, uploads[], usedBytes }
 * - Auth required (401 if unauthenticated)
 * - Cleans up expired pending uploads before listing
 *
 * ## POST /api/uploads
 * - Body: { filename, size, contentType? }
 * - Response: { key, url, maxFileSizeBytes, quotaBytes, usedBytes }
 * - Auth required (401 if unauthenticated)
 * - Creates a pending upload with 5-minute expiry
 * - Returns on-site Workers upload object URL
 *
 * ## Edge cases
 * - Unauthenticated GET/POST → 401
 * - Full upload flow: POST upload session → PUT to Workers/R2 route → POST /api/uploads/complete
 * - GET response includes quota metadata fields
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { createUploadedFileViaApi } from "../../../../utils/uploads";

test("/api/uploads GET 未登录返回 401", async ({ request }) => {
  const response = await request.get("/api/uploads");
  expect(response.status()).toBe(401);
});

test("/api/uploads GET 返回上传列表与配额元数据", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.get("/api/uploads");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    maxFileSizeBytes?: number;
    quotaBytes?: number;
    uploads?: Array<{ id?: string; filename?: string }>;
    usedBytes?: number;
  };

  expect(typeof body.maxFileSizeBytes).toBe("number");
  expect(typeof body.quotaBytes).toBe("number");
  expect(typeof body.usedBytes).toBe("number");
  expect(Array.isArray(body.uploads)).toBe(true);
});

test("/api/uploads POST 未登录返回 401", async ({ request }) => {
  const response = await request.post("/api/uploads", {
    data: {
      filename: "unauthorized.txt",
      contentType: "text/plain",
      size: 12,
    },
  });
  expect(response.status()).toBe(401);
});

test("/api/uploads POST 可申请上传并完成文件入库", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsDebugUser(page, "/");

  const filename = `e2e-api-upload-${Date.now()}.txt`;
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename,
    contents: "hello upload api",
  });

  try {
    const listResponse = await page.request.get("/api/uploads");
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as {
      uploads?: Array<{ id?: string; filename?: string }>;
      usedBytes?: number;
      quotaBytes?: number;
    };
    expect(
      listBody.uploads?.some(
        (u) => u.id === uploaded.uploadId && u.filename === filename,
      ),
    ).toBe(true);
    expect(typeof listBody.usedBytes).toBe("number");
    expect(typeof listBody.quotaBytes).toBe("number");
  } finally {
    await page.request.delete(`/api/uploads/${uploaded.uploadId}`);
  }
});
