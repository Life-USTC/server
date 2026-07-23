/**
 * E2E tests for PUT /api/workspace/homeworks/completions.
 *
 * ## PUT /api/workspace/homeworks/completions
 * - Body: { items: [{ homeworkId: string, completed: boolean }] }
 * - Response: { results: Array<{ success, homeworkId, completed, completedAt?, error? }> }
 * - Auth required (401 if unauthenticated)
 * - Returns per-item partial results for missing or deleted homework IDs
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

async function resolveSeedSectionId(
  request: import("@playwright/test").APIRequestContext,
) {
  const response = await request.post("/api/catalog/sections/match-codes", {
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

async function createTempHomework(
  request: import("@playwright/test").APIRequestContext,
  sectionId: number,
  title: string,
) {
  const now = new Date();
  const createResponse = await request.post(
    "/api/community/section-homeworks",
    {
      data: {
        title,
        sectionId: String(sectionId),
        publishedAt: now.toISOString(),
        submissionStartAt: now.toISOString(),
        submissionDueAt: new Date(now.getTime() + 86_400_000).toISOString(),
      },
    },
  );
  expect(createResponse.status()).toBe(201);

  const listResponse = await request.get(
    `/api/community/section-homeworks?sectionId=${sectionId}`,
  );
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    homeworks?: Array<{ id?: string; title?: string }>;
  };
  const homework = listBody.homeworks?.find((item) => item.title === title);
  expect(homework?.id).toBeTruthy();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  return homework!.id!;
}

test("/api/workspace/homeworks/completions 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/workspace/homeworks/completions",
  });
});

test("/api/workspace/homeworks/completions PUT 未登录返回 401", async ({
  request,
}) => {
  const response = await request.put("/api/workspace/homeworks/completions", {
    data: { items: [{ homeworkId: "invalid-e2e", completed: true }] },
  });
  expect(response.status()).toBe(401);
});

test("/api/workspace/homeworks/completions PUT 返回每项结果", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const suffix = `${Date.now()}`;
  const activeHomeworkId = await createTempHomework(
    page.request,
    sectionId,
    `e2e-batch-active-${suffix}`,
  );
  const deletedHomeworkId = await createTempHomework(
    page.request,
    sectionId,
    `e2e-batch-deleted-${suffix}`,
  );

  try {
    const deleteResponse = await page.request.delete(
      `/api/community/section-homeworks/${deletedHomeworkId}`,
    );
    expect(deleteResponse.status()).toBe(200);

    const response = await page.request.put(
      "/api/workspace/homeworks/completions",
      {
        data: {
          items: [
            { homeworkId: activeHomeworkId, completed: true },
            { homeworkId: deletedHomeworkId, completed: true },
            { homeworkId: "missing-e2e-homework", completed: false },
          ],
        },
      },
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      results?: Array<{
        success?: boolean;
        homeworkId?: string;
        completed?: boolean;
        completedAt?: string | null;
        error?: { code?: string; message?: string };
      }>;
    };

    expect(body.results).toHaveLength(3);
    expect(body.results?.[0]).toMatchObject({
      success: true,
      homeworkId: activeHomeworkId,
      completed: true,
    });
    expect(typeof body.results?.[0]?.completedAt).toBe("string");
    expect(body.results?.[1]).toMatchObject({
      success: false,
      homeworkId: deletedHomeworkId,
      completed: true,
      error: { code: "deleted" },
    });
    expect(body.results?.[2]).toMatchObject({
      success: false,
      homeworkId: "missing-e2e-homework",
      completed: false,
      error: { code: "not_found" },
    });
  } finally {
    await page.request.delete(
      `/api/community/section-homeworks/${activeHomeworkId}`,
    );
  }
});
