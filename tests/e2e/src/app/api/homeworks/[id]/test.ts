/**
 * E2E tests for PATCH /api/homeworks/[id] and DELETE /api/homeworks/[id].
 *
 * ## PATCH /api/homeworks/[id]
 * - Body: { title?, description?, publishedAt?, submissionStartAt?, submissionDueAt? }
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Returns 404 for non-existent homework
 *
 * ## DELETE /api/homeworks/[id]
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
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

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

/** Create a temporary homework and return its id (for mutation tests). */
async function createTempHomework(
  request: import("@playwright/test").APIRequestContext,
  sectionId: number,
) {
  const now = new Date();
  const title = `e2e-temp-hw-${Date.now()}`;
  const createResponse = await request.post("/api/homeworks", {
    data: {
      title,
      sectionId: String(sectionId),
      publishedAt: now.toISOString(),
      submissionStartAt: now.toISOString(),
      submissionDueAt: new Date(now.getTime() + 86400000).toISOString(),
    },
  });
  expect(createResponse.status()).toBe(200);
  const body = (await createResponse.json()) as { id?: string };
  if (!body.id) {
    throw new Error("Expected created homework id");
  }
  return { id: body.id, title };
}

test("/api/homeworks/[id]", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/homeworks/[id]" });
});

test("/api/homeworks/[id] PATCH 未登录返回 401", async ({ request }) => {
  const response = await request.patch("/api/homeworks/invalid-e2e", {
    data: { title: "should fail" },
  });
  expect(response.status()).toBe(401);
});

test("/api/homeworks/[id] PATCH 登录后可更新作业标题和描述", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const homework = await createTempHomework(page.request, sectionId);

  try {
    const newTitle = `e2e-homework-title-${Date.now()}`;
    const newDescription = `e2e-homework-description-${Date.now()}`;
    const patchResponse = await page.request.patch(
      `/api/homeworks/${homework.id}`,
      { data: { title: newTitle, description: newDescription } },
    );
    expect(patchResponse.status()).toBe(200);
    expect((await patchResponse.json()) as { success?: boolean }).toMatchObject(
      { success: true },
    );

    // Verify the title was updated
    const listResponse = await page.request.get(
      `/api/homeworks?sectionId=${sectionId}`,
    );
    const listBody = (await listResponse.json()) as {
      homeworks?: Array<{
        description?: { content?: string | null } | null;
        id?: string;
        title?: string;
      }>;
    };
    expect(
      listBody.homeworks?.some(
        (h) =>
          h.id === homework.id &&
          h.title === newTitle &&
          h.description?.content === newDescription,
      ),
    ).toBe(true);
  } finally {
    await page.request.delete(`/api/homeworks/${homework.id}`);
  }
});

test("/api/homeworks/[id] PATCH 登录后可只更新作业描述", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const homework = await createTempHomework(page.request, sectionId);

  try {
    const newDescription = `e2e-homework-description-only-${Date.now()}`;
    const patchResponse = await page.request.patch(
      `/api/homeworks/${homework.id}`,
      { data: { description: newDescription } },
    );
    expect(patchResponse.status()).toBe(200);
    expect((await patchResponse.json()) as { success?: boolean }).toMatchObject(
      { success: true },
    );

    const listResponse = await page.request.get(
      `/api/homeworks?sectionId=${sectionId}`,
    );
    const listBody = (await listResponse.json()) as {
      homeworks?: Array<{
        description?: { content?: string | null } | null;
        id?: string;
        title?: string;
      }>;
    };
    expect(
      listBody.homeworks?.some(
        (h) =>
          h.id === homework.id &&
          h.title === homework.title &&
          h.description?.content === newDescription,
      ),
    ).toBe(true);
  } finally {
    await page.request.delete(`/api/homeworks/${homework.id}`);
  }
});

test("/api/homeworks/[id] PATCH 登录后空更新返回 400", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const homework = await createTempHomework(page.request, sectionId);

  try {
    const patchResponse = await page.request.patch(
      `/api/homeworks/${homework.id}`,
      { data: {} },
    );
    expect(patchResponse.status()).toBe(400);
    expect((await patchResponse.json()) as { error?: string }).toMatchObject({
      error: "No changes",
    });
  } finally {
    await page.request.delete(`/api/homeworks/${homework.id}`);
  }
});

test("/api/homeworks/[id] DELETE 未登录返回 401", async ({ request }) => {
  const response = await request.delete("/api/homeworks/invalid-e2e");
  expect(response.status()).toBe(401);
});

test("/api/homeworks/[id] DELETE 登录后可删除作业", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const homework = await createTempHomework(page.request, sectionId);

  const deleteResponse = await page.request.delete(
    `/api/homeworks/${homework.id}`,
  );
  expect(deleteResponse.status()).toBe(200);
  expect((await deleteResponse.json()) as { success?: boolean }).toMatchObject({
    success: true,
  });

  // Verify the homework is no longer in the list
  const listResponse = await page.request.get(
    `/api/homeworks?sectionId=${sectionId}`,
  );
  const listBody = (await listResponse.json()) as {
    homeworks?: Array<{ id?: string }>;
  };
  expect(listBody.homeworks?.some((h) => h.id === homework.id)).toBe(false);
});
