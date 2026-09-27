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
import { resolveSeedSectionId } from "../../../../e2e/utils/seed-lookups";
import { homeworkExpectation } from "../../../../shared/specifications/homework";
import { signInAsDebugUserApi } from "../../_harness/auth";
import { assertApiContract } from "../../_shared/api-contract";

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
    data?: Array<{ id?: string; title?: string }>;
  };
  const homework = listBody.data?.find((item) => item.title === title);
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
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const sectionId = await resolveSeedSectionId(request);
  const suffix = `${Date.now()}`;
  const activeHomeworkId = await createTempHomework(
    request,
    sectionId,
    `e2e-batch-active-${suffix}`,
  );
  const deletedHomeworkId = await createTempHomework(
    request,
    sectionId,
    `e2e-batch-deleted-${suffix}`,
  );

  try {
    const deleteResponse = await request.delete(
      `/api/community/section-homeworks/${deletedHomeworkId}`,
    );
    expect(deleteResponse.status()).toBe(200);

    const response = await request.put("/api/workspace/homeworks/completions", {
      data: {
        items: [
          { homeworkId: activeHomeworkId, completed: true },
          { homeworkId: deletedHomeworkId, completed: true },
          { homeworkId: "missing-e2e-homework", completed: false },
        ],
      },
    });
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
    await request.delete(
      `/api/community/section-homeworks/${activeHomeworkId}`,
    );
  }
});

test("REST completion batches enforce specified bounds and duplicate policy over HTTP", async ({
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const specification = homeworkExpectation(
    "homework.rest-completion-batch-input",
    "collection_input",
  );
  const [method, path] = specification.operation.split(" ");
  const items = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      homeworkId: `missing-spec-homework-${index}`,
      completed: true,
    }));
  const send = (value: ReturnType<typeof items>) =>
    request.fetch(path, { method, data: { [specification.input]: value } });
  for (const size of [specification.min_items, specification.max_items]) {
    const response = await send(items(size));
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(size);
    for (const result of body.results)
      expect(result).toMatchObject({
        success: false,
        error: { code: "not_found" },
      });
  }
  for (const size of [
    specification.min_items - 1,
    specification.max_items + 1,
  ]) {
    expect((await send(items(size))).status()).toBe(400);
  }
  const duplicateResponse = await send([items(1)[0], items(1)[0]]);
  expect(duplicateResponse.status()).toBe(
    specification.unique_items ? 400 : 200,
  );
  if (!specification.unique_items)
    expect((await duplicateResponse.json()).results).toHaveLength(2);
});
