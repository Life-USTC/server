/**
 * E2E tests for GET /api/descriptions and POST /api/descriptions.
 *
 * ## GET /api/descriptions
 * - Query: targetType (section|course|teacher|homework) plus targetId or public identifiers such as sectionJwId/courseJwId/teacherId/homeworkId
 * - Response: { description: { id, content, ... } | null, history: DescriptionEdit[], viewer }
 * - Public endpoint (no auth required)
 * - Returns 400 for invalid/missing targetType or targetId
 * - Returns 200 with null description if target exists but has no description
 *
 * ## POST /api/descriptions
 * - Body: { targetType, targetId|sectionJwId|courseJwId|teacherId|homeworkId, content }
 * - Response: { id: string, updated: boolean }
 * - Auth required (401 if unauthenticated)
 * - Returns 403 if user is suspended
 * - Returns 404 if target entity does not exist
 * - Upserts: creates new description or updates existing
 * - Tracks edit history in descriptionEdit table
 * - Idempotent: posting same content returns { updated: false }
 *
 * ## Edge cases
 * - Invalid targetType → 400
 * - Missing targetId → 400
 * - Non-existent target on POST → 404
 * - Same content twice → updated: false on second call
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import {
  restoreDescriptionSnapshot,
  snapshotDescriptionForE2e,
  waitForDescriptionAuditRows,
} from "../../../../utils/description-state";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

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

test("/api/descriptions", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/descriptions" });
});

test("/api/descriptions GET 返回 seed 描述内容", async ({ request }) => {
  const sectionId = await resolveSeedSectionId(request);

  const response = await request.get(
    `/api/descriptions?targetType=section&targetId=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    description?: { id?: string; content?: string } | null;
    history?: Array<{ id?: string }>;
    viewer?: object;
  };

  expect(body.description).toBeDefined();
  expect(body.description?.content).toContain("课程建议");
  expect(body.viewer).toBeDefined();
});

test("/api/descriptions GET accepts public section JW id", async ({
  request,
}) => {
  const response = await request.get(
    `/api/descriptions?targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    description?: { content?: string } | null;
    viewer?: object;
  };

  expect(body.description?.content).toContain("课程建议");
  expect(body.viewer).toBeDefined();
});

test("/api/descriptions GET 无效 targetType 返回 400", async ({ request }) => {
  const response = await request.get(
    "/api/descriptions?targetType=invalid&targetId=1",
  );
  expect(response.status()).toBe(400);
});

test("/api/descriptions GET 缺少 targetId 返回 400", async ({ request }) => {
  const response = await request.get("/api/descriptions?targetType=section");
  expect(response.status()).toBe(400);
});

test("/api/descriptions GET 不存在的 target 返回 404", async ({ request }) => {
  const response = await request.get(
    "/api/descriptions?targetType=section&sectionJwId=999999999",
  );
  expect(response.status()).toBe(404);
});

test("/api/descriptions POST 未登录返回 401", async ({ request }) => {
  const response = await request.post("/api/descriptions", {
    data: {
      targetType: "section",
      targetId: "1",
      content: "should fail",
    },
  });
  expect(response.status()).toBe(401);
});

test("/api/descriptions POST 登录后可更新描述并还原", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  // Read original content first
  const originalResponse = await page.request.get(
    `/api/descriptions?targetType=section&targetId=${sectionId}`,
  );
  expect(originalResponse.status()).toBe(200);
  const originalBody = (await originalResponse.json()) as {
    description?: { content?: string; id?: string | null } | null;
  };
  const descriptionId = originalBody.description?.id;
  if (!descriptionId) {
    throw new Error("Expected seed description id");
  }
  const snapshot = await snapshotDescriptionForE2e(descriptionId, [
    "description_edit",
  ]);

  const newContent = `e2e-description-${Date.now()}`;
  try {
    // POST: update description
    const postResponse = await page.request.post("/api/descriptions", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        content: newContent,
      },
    });
    expect(postResponse.status()).toBe(200);
    const postBody = (await postResponse.json()) as {
      id?: string;
      updated?: boolean;
    };
    expect(postBody.id).toBeTruthy();
    expect(postBody.updated).toBe(true);

    // Verify the update via GET
    const getResponse = await page.request.get(
      `/api/descriptions?targetType=section&targetId=${sectionId}`,
    );
    expect(getResponse.status()).toBe(200);
    const getBody = (await getResponse.json()) as {
      description?: { content?: string } | null;
    };
    expect(getBody.description?.content).toContain(newContent);

    // Test idempotent upsert: same content returns updated: false
    const idempotentResponse = await page.request.post("/api/descriptions", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        content: newContent,
      },
    });
    expect(idempotentResponse.status()).toBe(200);
    const idempotentBody = (await idempotentResponse.json()) as {
      id?: string;
      updated?: boolean;
    };
    expect(idempotentBody.id).toBeTruthy();
    expect(idempotentBody.updated).toBe(false);
  } finally {
    await waitForDescriptionAuditRows(snapshot, 1);
    await restoreDescriptionSnapshot(snapshot);
  }
});

test("/api/descriptions POST accepts public section JW id", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");

  const originalResponse = await page.request.get(
    `/api/descriptions?targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
  );
  expect(originalResponse.status()).toBe(200);
  const originalBody = (await originalResponse.json()) as {
    description?: { content?: string; id?: string | null } | null;
  };
  const descriptionId = originalBody.description?.id;
  if (!descriptionId) {
    throw new Error("Expected seed description id");
  }
  const snapshot = await snapshotDescriptionForE2e(descriptionId, [
    "description_edit",
  ]);

  const newContent = `e2e-description-public-id-${Date.now()}`;
  try {
    const postResponse = await page.request.post("/api/descriptions", {
      data: {
        targetType: "section",
        sectionJwId: DEV_SEED.section.jwId,
        content: newContent,
      },
    });
    expect(postResponse.status()).toBe(200);
    const postBody = (await postResponse.json()) as {
      id?: string;
      updated?: boolean;
    };
    expect(postBody.id).toBeTruthy();
    expect(postBody.updated).toBe(true);

    const getResponse = await page.request.get(
      `/api/descriptions?targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
    );
    expect(getResponse.status()).toBe(200);
    const getBody = (await getResponse.json()) as {
      description?: { content?: string } | null;
    };
    expect(getBody.description?.content).toContain(newContent);
  } finally {
    await waitForDescriptionAuditRows(snapshot, 1);
    await restoreDescriptionSnapshot(snapshot);
  }
});

test("/api/descriptions POST 不存在的 target 返回 404", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const response = await page.request.post("/api/descriptions", {
    data: {
      targetType: "section",
      targetId: "999999999",
      content: "target does not exist",
    },
  });
  expect(response.status()).toBe(404);
});
