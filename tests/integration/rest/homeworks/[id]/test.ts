/**
 * E2E tests for PATCH /api/community/section-homeworks/[id] and DELETE /api/community/section-homeworks/[id].
 *
 * ## PATCH /api/community/section-homeworks/[id]
 * - Body: { title?, description?, publishedAt?, submissionStartAt?, submissionDueAt? }
 * - Response: { success: true, homework }
 * - Auth required (401 if unauthenticated)
 * - Returns 404 for non-existent homework
 *
 * ## DELETE /api/community/section-homeworks/[id]
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Soft-deletes the homework (sets deletedAt)
 * - Creates audit log entry (action: "deleted") with title snapshot
 * - Returns 404 for non-existent homework
 *
 * ## Edge cases
 * - Creates a temporary homework for mutations (does not modify seed data)
 * - Unauthenticated PATCH/DELETE → 401
 * - Non-existent id → 404
 */
import { expect, test } from "@playwright/test";
import { resolveSeedSectionId } from "../../../../e2e/utils/seed-lookups";
import { signInAsDebugUserApi } from "../../_harness/auth";
import { assertApiContract } from "../../_shared/api-contract";

/** Resolve the seed section's internal DB id via match-codes. */
/** Create a temporary homework and return its id (for mutation tests). */
async function createTempHomework(
  request: import("@playwright/test").APIRequestContext,
  sectionId: number,
) {
  const now = new Date();
  const title = `e2e-temp-hw-${Date.now()}`;
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
  const body = (await createResponse.json()) as {
    homework?: { id?: string; title?: string } | null;
    id?: string;
  };
  if (!body.id) {
    throw new Error("Expected created homework id");
  }
  expect(body.homework?.id).toBe(body.id);
  expect(body.homework?.title).toBe(title);
  return { id: body.id, title };
}

test("/api/community/section-homeworks/[id] 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/community/section-homeworks/[id]",
  });
});

test("/api/community/section-homeworks/[id] PATCH 未登录返回 401", async ({
  request,
}) => {
  const response = await request.patch(
    "/api/community/section-homeworks/invalid-e2e",
    {
      data: { title: "should fail" },
    },
  );
  expect(response.status()).toBe(401);
});

test("/api/community/section-homeworks/[id] PATCH 登录后可更新作业标题和描述", async ({
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const sectionId = await resolveSeedSectionId(request);
  const homework = await createTempHomework(request, sectionId);

  try {
    const newTitle = `e2e-homework-title-${Date.now()}`;
    const newDescription = `e2e-homework-description-${Date.now()}`;
    const patchResponse = await request.patch(
      `/api/community/section-homeworks/${homework.id}`,
      { data: { title: newTitle, description: newDescription } },
    );
    expect(patchResponse.status()).toBe(200);
    const patchBody = (await patchResponse.json()) as {
      homework?: {
        description?: { content?: string | null } | null;
        id?: string;
        title?: string;
      } | null;
      success?: boolean;
    };
    expect(patchBody.success).toBe(true);
    expect(patchBody.homework?.id).toBe(homework.id);
    expect(patchBody.homework?.title).toBe(newTitle);
    expect(patchBody.homework?.description?.content).toBe(newDescription);

    // Verify the title was updated
    const listResponse = await request.get(
      `/api/community/section-homeworks?sectionId=${sectionId}`,
    );
    const listBody = (await listResponse.json()) as {
      data?: Array<{
        description?: { content?: string | null } | null;
        id?: string;
        title?: string;
      }>;
    };
    expect(
      listBody.data?.some(
        (h) =>
          h.id === homework.id &&
          h.title === newTitle &&
          h.description?.content === newDescription,
      ),
    ).toBe(true);
  } finally {
    await request.delete(`/api/community/section-homeworks/${homework.id}`);
  }
});

test("/api/community/section-homeworks/[id] PATCH 登录后可只更新作业描述", async ({
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const sectionId = await resolveSeedSectionId(request);
  const homework = await createTempHomework(request, sectionId);

  try {
    const newDescription = `e2e-homework-description-only-${Date.now()}`;
    const patchResponse = await request.patch(
      `/api/community/section-homeworks/${homework.id}`,
      { data: { description: newDescription } },
    );
    expect(patchResponse.status()).toBe(200);
    const patchBody = (await patchResponse.json()) as {
      homework?: {
        description?: { content?: string | null } | null;
        id?: string;
        title?: string;
      } | null;
      success?: boolean;
    };
    expect(patchBody.success).toBe(true);
    expect(patchBody.homework?.id).toBe(homework.id);
    expect(patchBody.homework?.title).toBe(homework.title);
    expect(patchBody.homework?.description?.content).toBe(newDescription);

    const listResponse = await request.get(
      `/api/community/section-homeworks?sectionId=${sectionId}`,
    );
    const listBody = (await listResponse.json()) as {
      data?: Array<{
        description?: { content?: string | null } | null;
        id?: string;
        title?: string;
      }>;
    };
    expect(
      listBody.data?.some(
        (h) =>
          h.id === homework.id &&
          h.title === homework.title &&
          h.description?.content === newDescription,
      ),
    ).toBe(true);
  } finally {
    await request.delete(`/api/community/section-homeworks/${homework.id}`);
  }
});

test("/api/community/section-homeworks/[id] PATCH 登录后空更新返回 400", async ({
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const sectionId = await resolveSeedSectionId(request);
  const homework = await createTempHomework(request, sectionId);

  try {
    const patchResponse = await request.patch(
      `/api/community/section-homeworks/${homework.id}`,
      { data: {} },
    );
    expect(patchResponse.status()).toBe(400);
    expect((await patchResponse.json()) as { error?: string }).toMatchObject({
      error: "No changes",
    });
  } finally {
    await request.delete(`/api/community/section-homeworks/${homework.id}`);
  }
});

test("/api/community/section-homeworks/[id] DELETE 未登录返回 401", async ({
  request,
}) => {
  const response = await request.delete(
    "/api/community/section-homeworks/invalid-e2e",
  );
  expect(response.status()).toBe(401);
});

test("/api/community/section-homeworks/[id] DELETE 登录后可删除作业", async ({
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const sectionId = await resolveSeedSectionId(request);
  const homework = await createTempHomework(request, sectionId);

  const deleteResponse = await request.delete(
    `/api/community/section-homeworks/${homework.id}`,
  );
  expect(deleteResponse.status()).toBe(200);
  expect((await deleteResponse.json()) as { success?: boolean }).toMatchObject({
    success: true,
  });

  // Verify the homework is no longer in the list
  const listResponse = await request.get(
    `/api/community/section-homeworks?sectionId=${sectionId}`,
  );
  const listBody = (await listResponse.json()) as {
    data?: Array<{ id?: string }>;
  };
  expect(listBody.data?.some((h) => h.id === homework.id)).toBe(false);
});
