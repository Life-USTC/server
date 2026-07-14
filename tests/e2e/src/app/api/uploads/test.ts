/**
 * E2E tests for GET /api/uploads and POST /api/uploads.
 *
 * ## GET /api/uploads
 * - Response: { maxFileSizeBytes, quotaBytes, uploads[], usedBytes }
 * - Auth required (401 if unauthenticated)
 * - Ignores expired pending uploads for quota without mutating them
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
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { prisma } from "@/lib/db/prisma";
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

test("/api/uploads GET 忽略过期预留但不执行清理写入", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const sessionResponse = await page.request.get("/api/auth/get-session");
  const session = (await sessionResponse.json()) as {
    user?: { id?: string };
  };
  const userId = session.user?.id;
  expect(userId).toBeTruthy();
  if (!userId) throw new Error("Expected signed-in E2E user id");

  const beforeResponse = await page.request.get("/api/uploads");
  const before = (await beforeResponse.json()) as { usedBytes?: number };
  const key = `uploads/${userId}/expired-read-${Date.now()}.txt`;
  const pending = await prisma.uploadPending.create({
    data: {
      contentType: "text/plain",
      expiresAt: new Date(Date.now() - 60_000),
      filename: "expired-read.txt",
      key,
      size: 12_345,
      userId,
    },
  });

  try {
    const response = await page.request.get("/api/uploads");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { usedBytes?: number };
    expect(body.usedBytes).toBe(before.usedBytes);
    await expect(
      prisma.uploadPending.findUnique({ where: { id: pending.id } }),
    ).resolves.not.toBeNull();
  } finally {
    await prisma.uploadPending.deleteMany({ where: { id: pending.id } });
  }
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

test("/api/uploads POST 超出单文件大小返回 413", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.post("/api/uploads", {
    data: {
      filename: "too-large.txt",
      contentType: "text/plain",
      size: uploadConfig.maxFileSizeBytes + 1,
    },
  });

  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ error: "File too large" });
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
