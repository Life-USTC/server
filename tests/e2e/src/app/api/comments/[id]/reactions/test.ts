/**
 * E2E tests for POST/DELETE /api/comments/{id}/reactions.
 *
 * ## POST /api/comments/{id}/reactions
 * - Body: { type } where type is one of: upvote|downvote|heart|laugh|hooray|confused|rocket|eyes
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Returns 403 if user is suspended
 * - Returns 404 if comment does not exist
 * - Upserts: adding the same reaction twice is idempotent
 *
 * ## DELETE /api/comments/{id}/reactions
 * - Query: type (same enum as POST)
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Deletes matching reaction; no-op if not present (still returns success)
 * - Returns 403 when the comment exists but is inactive
 *
 * ## Edge cases
 * - POST reaction on non-existent comment → 404
 * - DELETE reaction on non-existent comment → still 200 (deleteMany)
 * - Verify reaction appears in comment's reactions array after POST
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../../utils/auth";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { withE2ePrisma } from "../../../../../../utils/e2e-db/prisma";
import { assertApiContract } from "../../../../_shared/api-contract";

/** Resolve the seed section's internal DB id via match-codes. */
async function resolveSeedSectionId(
  request: import("@playwright/test").APIRequestContext,
) {
  const response = await request.post("/api/sections/match-codes", {
    data: { codes: [DEV_SEED.section.code] },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    sections?: Array<{ id?: number; code?: string | null }>;
  };
  const section = body.sections?.find((s) => s.code === DEV_SEED.section.code);
  expect(section?.id).toBeDefined();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  return section!.id!;
}

/** Find the seed root comment by body content. */
async function findSeedCommentId(
  request: import("@playwright/test").APIRequestContext,
  sectionId: number,
) {
  const response = await request.get(
    `/api/comments?targetType=section&targetId=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    comments?: Array<{ id?: string; body?: string }>;
  };
  const seed = body.comments?.find((c) =>
    c.body?.includes(DEV_SEED.comments.sectionRootBody),
  );
  expect(seed?.id).toBeTruthy();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  return seed!.id!;
}

test("/api/comments/[id]/reactions 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/comments/[id]/reactions",
  });
});

test("/api/comments/[id]/reactions POST 未登录返回 401", async ({
  request,
}) => {
  const response = await request.post(
    "/api/comments/00000000-0000-0000-0000-000000000000/reactions",
    { data: { type: "rocket" } },
  );
  expect(response.status()).toBe(401);
});

test("/api/comments/[id]/reactions DELETE 未登录返回 401", async ({
  request,
}) => {
  const response = await request.delete(
    "/api/comments/00000000-0000-0000-0000-000000000000/reactions?type=rocket",
  );
  expect(response.status()).toBe(401);
});

test("/api/comments/[id]/reactions 登录后可添加并验证再删除", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const commentId = await findSeedCommentId(page.request, sectionId);

  // POST is idempotent, including duplicate requests that arrive together.
  const createResponses = await Promise.all([
    page.request.post(`/api/comments/${commentId}/reactions`, {
      data: { type: "rocket" },
    }),
    page.request.post(`/api/comments/${commentId}/reactions`, {
      data: { type: "rocket" },
    }),
  ]);
  for (const createResponse of createResponses) {
    expect(createResponse.status()).toBe(200);
    expect((await createResponse.json()) as { success?: boolean }).toEqual({
      success: true,
    });
  }

  // Verify the reaction is visible in the thread
  const threadResponse = await page.request.get(`/api/comments/${commentId}`);
  expect(threadResponse.status()).toBe(200);
  const threadBody = (await threadResponse.json()) as {
    thread?: Array<{
      id?: string;
      reactions?: Array<{ type?: string; count?: number }>;
      viewerReactions?: string[];
    }>;
  };
  const focusNode = threadBody.thread?.find((n) => n.id === commentId);
  expect(focusNode).toBeDefined();
  expect(focusNode?.reactions?.some((r) => r.type === "rocket")).toBe(true);

  // DELETE: remove the rocket reaction
  const deleteResponse = await page.request.delete(
    `/api/comments/${commentId}/reactions?type=rocket`,
  );
  expect(deleteResponse.status()).toBe(200);
  expect((await deleteResponse.json()) as { success?: boolean }).toEqual({
    success: true,
  });
});

test("/api/comments/[id]/reactions POST 不存在的评论返回 404", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.post(
    "/api/comments/00000000-0000-0000-0000-000000000000/reactions",
    { data: { type: "heart" } },
  );
  expect(response.status()).toBe(404);
});

test("/api/comments/[id]/reactions POST 对失效评论返回 403", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const content = `e2e-inactive-reaction-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(201);
  const commentId = ((await createResponse.json()) as { id?: string }).id;
  expect(commentId).toBeTruthy();
  if (!commentId) {
    throw new Error("Expected created comment id");
  }

  try {
    await withE2ePrisma((prisma) =>
      prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date(), status: "deleted" },
      }),
    );

    const deletedResponse = await page.request.post(
      `/api/comments/${commentId}/reactions`,
      { data: { type: "heart" } },
    );
    expect(deletedResponse.status()).toBe(403);

    await withE2ePrisma((prisma) =>
      prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: null, status: "softbanned" },
      }),
    );

    const softbannedResponse = await page.request.post(
      `/api/comments/${commentId}/reactions`,
      { data: { type: "heart" } },
    );
    expect(softbannedResponse.status()).toBe(403);
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({ where: { id: commentId } }),
    );
  }
});

test("/api/comments/[id]/reactions DELETE 对失效评论返回 403", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const content = `e2e-inactive-reaction-delete-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(201);
  const commentId = ((await createResponse.json()) as { id?: string }).id;
  expect(commentId).toBeTruthy();
  if (!commentId) {
    throw new Error("Expected created comment id");
  }

  try {
    const reactionResponse = await page.request.post(
      `/api/comments/${commentId}/reactions`,
      { data: { type: "heart" } },
    );
    expect(reactionResponse.status()).toBe(200);

    await withE2ePrisma((prisma) =>
      prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date(), status: "deleted" },
      }),
    );

    const deletedResponse = await page.request.delete(
      `/api/comments/${commentId}/reactions?type=heart`,
    );
    expect(deletedResponse.status()).toBe(403);

    await withE2ePrisma((prisma) =>
      prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: null, status: "softbanned" },
      }),
    );

    const softbannedResponse = await page.request.delete(
      `/api/comments/${commentId}/reactions?type=heart`,
    );
    expect(softbannedResponse.status()).toBe(403);
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({ where: { id: commentId } }),
    );
  }
});
