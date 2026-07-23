/**
 * E2E tests for GET /api/community/homeworks and POST /api/community/homeworks.
 *
 * ## GET /api/community/homeworks
 * - Query: sectionId (required)
 * - Response: { viewer, homeworks[], auditLogs[] }
 * - Public endpoint: viewer.userId is null when unauthenticated
 * - Returns homeworks with completion status for the current user
 * - Includes audit logs for the section's homeworks
 *
 * ## POST /api/community/homeworks
 * - Body: { title, sectionId, publishedAt, submissionStartAt, submissionDueAt }
 * - Response: { id, homework }
 * - Auth required (401 if unauthenticated)
 * - Creates a homework with an audit log entry (action: "created")
 * - Returns 400 for missing required fields
 *
 * ## Edge cases
 * - Missing sectionId on GET → 400
 * - Unauthenticated POST → 401
 * - Full create → verify in list → cleanup via DELETE
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

/** Resolve the seed section's internal DB id via match-codes. */
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

test("/api/community/homeworks 接口契约", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/community/homeworks" });
});

test("/api/community/homeworks GET 返回 seed 作业、completion 与审计日志", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const response = await page.request.get(
    `/api/community/homeworks?sectionId=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    viewer?: { userId?: string | null };
    homeworks?: Array<Record<string, unknown>>;
    auditLogs?: Array<{ action?: string; titleSnapshot?: string }>;
  };

  expect(body.viewer?.userId).toBeTruthy();
  expect(
    body.homeworks?.some((item) => item.title === DEV_SEED.homeworks.title),
  ).toBe(true);
  expect(
    body.homeworks?.some((item) => Object.hasOwn(item, "completion")),
  ).toBe(true);
  expect(
    body.homeworks?.every(
      (item) =>
        typeof item.commentCount === "number" &&
        Number.isInteger(item.commentCount as number),
    ),
  ).toBe(true);
  expect(
    body.auditLogs?.some(
      (item) =>
        item.action === "created" &&
        typeof item.titleSnapshot === "string" &&
        item.titleSnapshot.length > 0,
    ),
  ).toBe(true);

  // Verify HomeworkItem fields on the seed homework
  const seedHomework = body.homeworks?.find(
    (item) => item.title === DEV_SEED.homeworks.title,
  );
  expect(seedHomework).toBeDefined();
  if (!seedHomework) return;

  expect(typeof seedHomework.id).toBe("string");
  expect(seedHomework.id).toBeTruthy();
  expect(typeof seedHomework.title).toBe("string");
  expect(Object.hasOwn(seedHomework, "publishedAt")).toBe(true);
  expect(Object.hasOwn(seedHomework, "submissionStartAt")).toBe(true);
  expect(Object.hasOwn(seedHomework, "submissionDueAt")).toBe(true);
  expect(typeof seedHomework.createdAt).toBe("string");
  expect(Object.hasOwn(seedHomework, "updatedAt")).toBe(true);
  expect(typeof seedHomework.sectionId).toBe("number");

  const jwResponse = await page.request.get(
    `/api/community/homeworks?sectionJwId=${DEV_SEED.section.jwId}`,
  );
  expect(jwResponse.status()).toBe(200);
  const jwBody = (await jwResponse.json()) as {
    homeworks?: Array<Record<string, unknown>>;
  };
  expect(
    jwBody.homeworks?.some((item) => item.title === DEV_SEED.homeworks.title),
  ).toBe(true);

  const section = seedHomework.section as
    | { code?: unknown; course?: { nameCn?: unknown } }
    | undefined;
  expect(typeof section?.code).toBe("string");
  expect(typeof section?.course?.nameCn).toBe("string");

  expect(Object.hasOwn(seedHomework, "createdBy")).toBe(true);
  expect(Object.hasOwn(seedHomework, "updatedBy")).toBe(true);
});

test("/api/community/homeworks GET 未找到 sectionJwId 返回 404", async ({
  request,
}) => {
  const response = await request.get(
    "/api/community/homeworks?sectionJwId=999999999",
  );
  expect(response.status()).toBe(404);
});

test("/api/community/homeworks POST 未登录返回 401", async ({ request }) => {
  const now = new Date();
  const response = await request.post("/api/community/homeworks", {
    data: {
      title: "should fail",
      sectionId: "1",
      publishedAt: now.toISOString(),
      submissionStartAt: now.toISOString(),
      submissionDueAt: new Date(now.getTime() + 86400000).toISOString(),
    },
  });
  expect(response.status()).toBe(401);
});

test("/api/community/homeworks POST 登录后可创建作业并清理", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const title = `e2e-homework-create-${Date.now()}`;
  const now = new Date();
  const createResponse = await page.request.post("/api/community/homeworks", {
    data: {
      title,
      sectionId: String(sectionId),
      publishedAt: now.toISOString(),
      submissionStartAt: now.toISOString(),
      submissionDueAt: new Date(now.getTime() + 86400000).toISOString(),
    },
  });
  expect(createResponse.status()).toBe(201);
  const createBody = (await createResponse.json()) as {
    homework?: { commentCount?: number; id?: string; title?: string } | null;
    id?: string;
  };
  expect(createBody.id).toBeTruthy();
  expect(createResponse.headers().location).toBe(
    `/api/community/homeworks/${createBody.id}`,
  );
  expect(createBody.homework?.id).toBe(createBody.id);
  expect(createBody.homework?.title).toBe(title);
  expect(createBody.homework?.commentCount).toBe(0);

  // Verify the created homework appears in the list
  const listResponse = await page.request.get(
    `/api/community/homeworks?sectionId=${sectionId}`,
  );
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    homeworks?: Array<{ id?: string; title?: string }>;
  };
  const created = listBody.homeworks?.find((h) => h.title === title);
  expect(created?.id).toBeTruthy();

  // Cleanup
  if (created?.id) {
    await page.request.delete(`/api/community/homeworks/${created.id}`);
  }
});
