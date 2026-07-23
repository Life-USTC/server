/**
 * E2E tests for GET /api/workspace/uploads and POST /api/workspace/uploads.
 *
 * ## GET /api/workspace/uploads
 * - Query: page, pageSize (deprecated alias: limit)
 * - Response: { data: Upload[], pagination, meta: { maxFileSizeBytes, quotaBytes, usedBytes } }
 * - Auth required (401 if unauthenticated)
 * - Ignores expired pending uploads for quota without mutating them
 *
 * ## POST /api/workspace/uploads
 * - Body: { filename, size, contentType? }
 * - Response: { key, url, maxFileSizeBytes, quotaBytes, usedBytes }
 * - Auth required (401 if unauthenticated)
 * - Creates a pending upload with 5-minute expiry
 * - Returns on-site Workers upload object URL
 *
 * ## Edge cases
 * - Unauthenticated GET/POST → 401
 * - Full upload flow: POST upload session → PUT to Workers/R2 route → POST /api/workspace/uploads/complete
 * - GET response includes quota metadata fields
 */
import { expect, test } from "@playwright/test";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { signInAsDebugUser } from "../../../../utils/auth";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createUploadedFileViaApi } from "../../../../utils/uploads";

test("/api/workspace/uploads GET 未登录返回 401", async ({ request }) => {
  const response = await request.get("/api/workspace/uploads");
  expect(response.status()).toBe(401);
});

test("/api/workspace/uploads GET 返回上传列表与配额元数据", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.get("/api/workspace/uploads");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: Array<{ id?: string; filename?: string }>;
    meta?: {
      maxFileSizeBytes?: number;
      quotaBytes?: number;
      usedBytes?: number;
    };
    pagination?: { page?: number; pageSize?: number; total?: number };
  };

  expect(typeof body.meta?.maxFileSizeBytes).toBe("number");
  expect(typeof body.meta?.quotaBytes).toBe("number");
  expect(typeof body.meta?.usedBytes).toBe("number");
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.pagination).toMatchObject({ page: 1, pageSize: 20 });
});

test("/api/workspace/uploads GET 支持稳定的第二页与废弃 limit 别名", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sessionResponse = await page.request.get("/api/auth/get-session");
  const userId = ((await sessionResponse.json()) as { user?: { id?: string } })
    .user?.id;
  expect(userId).toBeTruthy();
  if (!userId) throw new Error("Expected signed-in E2E user id");

  const marker = `e2e-upload-pagination-${Date.now()}`;
  const created = await withE2ePrisma(async (prisma) => {
    const rows = [];
    for (let index = 0; index < 3; index += 1) {
      rows.push(
        await prisma.upload.create({
          data: {
            contentType: "text/plain",
            createdAt: new Date(Date.now() + 60_000 + index),
            filename: `${marker}-${index}.txt`,
            key: `${marker}-${index}`,
            size: index + 1,
            userId,
          },
          select: { id: true },
        }),
      );
    }
    return rows;
  });

  try {
    const firstResponse = await page.request.get(
      "/api/workspace/uploads?page=1&pageSize=1",
    );
    const secondResponse = await page.request.get(
      "/api/workspace/uploads?page=2&limit=1",
    );
    expect(firstResponse.status()).toBe(200);
    expect(secondResponse.status()).toBe(200);
    const first = (await firstResponse.json()) as {
      data?: Array<{ id?: string }>;
      pagination?: { total?: number };
    };
    const second = (await secondResponse.json()) as {
      data?: Array<{ id?: string }>;
      pagination?: { page?: number; pageSize?: number; total?: number };
    };
    expect(first.data?.[0]?.id).toBe(created[2]?.id);
    expect(second.data?.[0]?.id).toBe(created[1]?.id);
    expect(second.pagination).toMatchObject({
      page: 2,
      pageSize: 1,
      total: first.pagination?.total,
    });
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.upload.deleteMany({ where: { key: { startsWith: marker } } }),
    );
  }
});

test("/api/workspace/uploads GET 忽略过期预留但不执行清理写入", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");

  const sessionResponse = await page.request.get("/api/auth/get-session");
  const session = (await sessionResponse.json()) as {
    user?: { id?: string };
  };
  const userId = session.user?.id;
  expect(userId).toBeTruthy();
  if (!userId) throw new Error("Expected signed-in E2E user id");

  const beforeResponse = await page.request.get("/api/workspace/uploads");
  const before = (await beforeResponse.json()) as {
    meta?: { usedBytes?: number };
  };
  const key = `uploads/${userId}/expired-read-${Date.now()}.txt`;
  const pending = await withE2ePrisma((prisma) =>
    prisma.uploadPending.create({
      data: {
        contentType: "text/plain",
        expiresAt: new Date(Date.now() - 60_000),
        filename: "expired-read.txt",
        key,
        size: 12_345,
        userId,
      },
    }),
  );

  try {
    const response = await page.request.get("/api/workspace/uploads");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      meta?: { usedBytes?: number };
    };
    expect(body.meta?.usedBytes).toBe(before.meta?.usedBytes);
    await expect(
      withE2ePrisma((prisma) =>
        prisma.uploadPending.findUnique({ where: { id: pending.id } }),
      ),
    ).resolves.not.toBeNull();
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.uploadPending.deleteMany({ where: { id: pending.id } }),
    );
  }
});

test("/api/workspace/uploads POST 未登录返回 401", async ({ request }) => {
  const response = await request.post("/api/workspace/uploads", {
    data: {
      filename: "unauthorized.txt",
      contentType: "text/plain",
      size: 12,
    },
  });
  expect(response.status()).toBe(401);
});

test("/api/workspace/uploads POST 超出单文件大小返回 413", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.post("/api/workspace/uploads", {
    data: {
      filename: "too-large.txt",
      contentType: "text/plain",
      size: uploadConfig.maxFileSizeBytes + 1,
    },
  });

  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ error: "File too large" });
});

test("/api/workspace/uploads POST 可申请上传并完成文件入库", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signInAsDebugUser(page, "/");

  const filename = `e2e-api-upload-${Date.now()}.txt`;
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename,
    contents: "hello upload api",
  });

  try {
    const listResponse = await page.request.get("/api/workspace/uploads");
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as {
      data?: Array<{ id?: string; filename?: string }>;
      meta?: { quotaBytes?: number; usedBytes?: number };
    };
    expect(
      listBody.data?.some(
        (u) => u.id === uploaded.uploadId && u.filename === filename,
      ),
    ).toBe(true);
    expect(typeof listBody.meta?.usedBytes).toBe("number");
    expect(typeof listBody.meta?.quotaBytes).toBe("number");
  } finally {
    await page.request.delete(`/api/workspace/uploads/${uploaded.uploadId}`);
  }
});
