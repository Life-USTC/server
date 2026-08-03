/**
 * E2E tests for GET /api/workspace/uploads/[id]/download.
 *
 * ## GET /api/workspace/uploads/[id]/download
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
import { expect, test  } from "@playwright/test";
import { resolveSeedSectionId } from "../../../../../e2e/utils/seed-lookups";
import { createUploadedFileViaApi } from "../../../../../e2e/utils/uploads";
import { assertApiContract } from "../../../_shared/api-contract";
import { signInAsDebugUserApi, signInAsDevAdminApi } from "../../../_harness/auth";

test("/api/workspace/uploads/[id]/download", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/workspace/uploads/[id]/download",
  });
});

test("/api/workspace/uploads/[id]/download GET 未登录返回 401", async ({
  request,
}) => {
  const response = await request.get(
    "/api/workspace/uploads/invalid-e2e/download",
  );
  expect(response.status()).toBe(401);
});

test("/api/workspace/uploads/[id]/download GET 可下载自己的文件", async ({ request, }) => {
  test.setTimeout(60_000);
  await signInAsDebugUserApi(request, "/");

  const filename = `e2e-download-${Date.now()}.txt`;
  const uploaded = await createUploadedFileViaApi(request, {
    filename,
    contents: "download test content",
  });

  try {
    const downloadResponse = await request.get(
      `/api/workspace/uploads/${uploaded.uploadId}/download`,
    );
    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()["content-disposition"]).toContain(
      filename,
    );
  } finally {
    await request.delete(`/api/workspace/uploads/${uploaded.uploadId}`);
  }
});

test("/api/workspace/uploads/[id]/download GET 非本人返回 404", async ({ playwright }) => {
  const userContext = await playwright.request.newContext();
    try {
    await signInAsDebugUserApi(userContext, "/");

    // Create a file as debug user
    const filename = `e2e-download-nonowner-${Date.now()}.txt`;
    const uploaded = await createUploadedFileViaApi(userContext, {
      filename,
      contents: "non-owner download test",
    });

    try {
      // Try to download as admin user
      const adminContext = await playwright.request.newContext();
            try {
        await signInAsDevAdminApi(adminContext, "/");
        const downloadResponse = await adminContext.get(
          `/api/workspace/uploads/${uploaded.uploadId}/download`,
          { maxRedirects: 0 },
        );
        expect(downloadResponse.status()).toBe(404);
      } finally {
        await adminContext.dispose();
      }
    } finally {
      await userContext.delete(
        `/api/workspace/uploads/${uploaded.uploadId}`,
      );
    }
  } finally {
    await userContext.dispose();
  }
});

test("/api/workspace/uploads/[id]/download GET 允许下载可见评论附件", async ({ playwright }) => {
  const userContext = await playwright.request.newContext();
    try {
    await signInAsDebugUserApi(userContext, "/");
    const sectionId = await resolveSeedSectionId(userContext);
    const uploaded = await createUploadedFileViaApi(userContext, {
      filename: `e2e-comment-attachment-${Date.now()}.txt`,
      contents: "visible comment attachment",
    });

    const createCommentResponse = await userContext.post(
      "/api/community/comments",
      {
        data: {
          attachmentIds: [uploaded.uploadId],
          body: `e2e comment attachment ${Date.now()}`,
          targetId: String(sectionId),
          targetType: "section",
          visibility: "public",
        },
      },
    );
    expect(createCommentResponse.status()).toBe(201);
    const commentId = ((await createCommentResponse.json()) as { id?: string })
      .id;
    expect(commentId).toBeTruthy();

    try {
      const adminContext = await playwright.request.newContext();
            try {
        await signInAsDevAdminApi(adminContext, "/");
        const downloadResponse = await adminContext.get(
          `/api/workspace/uploads/${uploaded.uploadId}/download`,
        );
        expect(downloadResponse.status()).toBe(200);
        await expect(downloadResponse.text()).resolves.toBe(
          "visible comment attachment",
        );
      } finally {
        await adminContext.dispose();
      }
    } finally {
      if (commentId) {
        await userContext.delete(`/api/community/comments/${commentId}`);
      }
      await userContext.delete(
        `/api/workspace/uploads/${uploaded.uploadId}`,
      );
    }
  } finally {
    await userContext.dispose();
  }
});

test("/api/workspace/uploads/[id]/download GET 拒绝下载已删除评论附件", async ({ playwright }) => {
  const userContext = await playwright.request.newContext();
    try {
    await signInAsDebugUserApi(userContext, "/");
    const sectionId = await resolveSeedSectionId(userContext);
    const uploaded = await createUploadedFileViaApi(userContext, {
      filename: `e2e-deleted-comment-attachment-${Date.now()}.txt`,
      contents: "deleted comment attachment",
    });

    const createCommentResponse = await userContext.post(
      "/api/community/comments",
      {
        data: {
          attachmentIds: [uploaded.uploadId],
          body: `e2e deleted comment attachment ${Date.now()}`,
          targetId: String(sectionId),
          targetType: "section",
          visibility: "public",
        },
      },
    );
    expect(createCommentResponse.status()).toBe(201);
    const commentId = ((await createCommentResponse.json()) as { id?: string })
      .id;
    expect(commentId).toBeTruthy();

    try {
      await userContext.delete(`/api/community/comments/${commentId}`);
      const adminContext = await playwright.request.newContext();
            try {
        await signInAsDevAdminApi(adminContext, "/");
        const downloadResponse = await adminContext.get(
          `/api/workspace/uploads/${uploaded.uploadId}/download`,
          { maxRedirects: 0 },
        );
        expect(downloadResponse.status()).toBe(404);
      } finally {
        await adminContext.dispose();
      }
    } finally {
      await userContext.delete(
        `/api/workspace/uploads/${uploaded.uploadId}`,
      );
    }
  } finally {
    await userContext.dispose();
  }
});

test("/api/workspace/uploads/[id]/download GET 不存在的 id 返回 404", async ({ request, }) => {
  await signInAsDebugUserApi(request, "/");
  const response = await request.get(
    "/api/workspace/uploads/00000000-0000-0000-0000-000000000000/download",
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(404);
});
