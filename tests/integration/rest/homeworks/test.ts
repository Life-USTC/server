/**
 * E2E tests for GET /api/community/section-homeworks and POST /api/community/section-homeworks.
 *
 * ## GET /api/community/section-homeworks
 * - Query: sectionId (required)
 * - Response: { viewer, data[], pagination }
 * - Public endpoint: viewer.userId is null when unauthenticated
 * - Returns homeworks with completion status for the current user
 * - Does not load descriptions, detail relations, or audit logs
 *
 * ## GET /api/community/section-homeworks/audit
 * - Loads section-wide audit history only after an explicit request
 *
 * ## POST /api/community/section-homeworks
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
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import { resolveSeedSectionId } from "../../../e2e/utils/seed-lookups";
import {
  assertHomeworkCreateSuccess,
  assertHomeworkListedByTitle,
} from "../../../shared/scenarios/homework-create";
import { signInAsDebugUserApi } from "../_harness/auth";
import { assertApiContract } from "../_shared/api-contract";

/** Resolve the seed section's internal DB id via match-codes. */
test("/api/community/section-homeworks 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/community/section-homeworks",
  });
});

test("/api/community/section-homeworks/audit 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/community/section-homeworks/audit",
  });
});

test("/api/community/section-homeworks GET 返回 summary，详情按需加载", async ({
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const sectionId = await resolveSeedSectionId(request);

  const response = await request.get(
    `/api/community/section-homeworks?sectionId=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    viewer?: { userId?: string | null };
    data?: Array<Record<string, unknown>>;
    pagination?: { page?: number; pageSize?: number; total?: number };
  };

  expect(body.viewer?.userId).toBeTruthy();
  expect(
    body.data?.some((item) => item.title === DEV_SEED.homeworks.title),
  ).toBe(true);
  expect(body.data?.some((item) => Object.hasOwn(item, "completion"))).toBe(
    true,
  );
  expect(
    body.data?.every(
      (item) =>
        typeof item.commentCount === "number" &&
        Number.isInteger(item.commentCount as number),
    ),
  ).toBe(true);

  // Verify HomeworkItem fields on the seed homework
  expect(body.pagination).toMatchObject({ page: 1, pageSize: 20 });
  const seedHomework = body.data?.find(
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
  expect(Object.hasOwn(seedHomework, "description")).toBe(false);
  expect(Object.hasOwn(seedHomework, "section")).toBe(false);
  expect(Object.hasOwn(seedHomework, "createdBy")).toBe(false);
  expect(Object.hasOwn(seedHomework, "updatedBy")).toBe(false);

  const detailResponse = await request.get(
    `/api/community/section-homeworks/${encodeURIComponent(seedHomework.id as string)}`,
  );
  expect(detailResponse.status()).toBe(200);
  const detailBody = (await detailResponse.json()) as {
    auditLogs?: Array<{ action?: string; titleSnapshot?: string | null }>;
    homework?: Record<string, unknown>;
  };
  expect(detailBody.homework?.description).toBeDefined();
  expect(detailBody.homework?.section).toBeDefined();
  expect(detailBody.auditLogs?.some((item) => item.action === "created")).toBe(
    true,
  );

  const auditResponse = await request.get(
    `/api/community/section-homeworks/audit?sectionId=${sectionId}`,
  );
  expect(auditResponse.status()).toBe(200);
  const auditBody = (await auditResponse.json()) as {
    auditLogs?: Array<{ homeworkId?: string | null }>;
  };
  expect(
    auditBody.auditLogs?.some((item) => item.homeworkId === seedHomework.id),
  ).toBe(true);

  const jwResponse = await request.get(
    `/api/community/section-homeworks?sectionJwId=${DEV_SEED.section.jwId}`,
  );
  expect(jwResponse.status()).toBe(200);
  const jwBody = (await jwResponse.json()) as {
    data?: Array<Record<string, unknown>>;
  };
  expect(
    jwBody.data?.some((item) => item.title === DEV_SEED.homeworks.title),
  ).toBe(true);
});

test("/api/community/section-homeworks GET 未找到 sectionJwId 返回 404", async ({
  request,
}) => {
  const response = await request.get(
    "/api/community/section-homeworks?sectionJwId=999999999",
  );
  expect(response.status()).toBe(404);
});

test("/api/community/section-homeworks GET 拒绝过多班级与越界分页", async ({
  request,
}) => {
  const sectionIds = Array.from({ length: 51 }, (_, index) => index + 1).join(
    ",",
  );

  expect(
    (
      await request.get(
        `/api/community/section-homeworks?sectionIds=${sectionIds}`,
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get("/api/community/section-homeworks?sectionId=1&page=101")
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get(
        "/api/community/section-homeworks?sectionId=1&pageSize=51",
      )
    ).status(),
  ).toBe(400);
});

test("/api/community/section-homeworks POST 未登录返回 401", async ({
  request,
}) => {
  const now = new Date();
  const response = await request.post("/api/community/section-homeworks", {
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

test("/api/community/section-homeworks POST 登录后可创建作业并清理", async ({
  request,
}) => {
  await signInAsDebugUserApi(request, "/");
  const sectionId = await resolveSeedSectionId(request);

  const title = `e2e-homework-create-${Date.now()}`;
  const now = new Date();
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
  const createBody = (await createResponse.json()) as {
    homework?: { commentCount?: number; id?: string; title?: string } | null;
    id?: string;
  };
  assertHomeworkCreateSuccess(createBody);
  expect(createResponse.headers().location).toBe(
    `/api/community/section-homeworks/${createBody.id}`,
  );
  expect(createBody.homework?.title).toBe(title);
  expect(createBody.homework?.commentCount).toBe(0);

  // Verify the created homework appears in the list
  const listResponse = await request.get(
    `/api/community/section-homeworks?sectionId=${sectionId}`,
  );
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    data?: Array<{ id?: string; title?: string }>;
  };
  assertHomeworkListedByTitle(listBody.data ?? [], {
    id: createBody.id,
    title,
  });

  // Cleanup
  await request.delete(`/api/community/section-homeworks/${createBody.id}`);
});
