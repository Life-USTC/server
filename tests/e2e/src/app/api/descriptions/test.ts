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
import { expect, type TestInfo, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import {
  snapshotDescriptionForE2e,
  waitForDescriptionAuditRows,
} from "../../../../utils/description-state";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { assertApiContract } from "../../_shared/api-contract";

type DisposableDescriptionFixture = {
  courseId: number;
  descriptionId: string;
  originalContent: string;
  sectionId: number;
  sectionJwId: number;
};

let disposableFixtureCounter = 0;

function nextDisposableJwId(testInfo: TestInfo) {
  const counter = disposableFixtureCounter;
  disposableFixtureCounter += 1;
  return (
    1_000_000_000 +
    (Date.now() % 10_000_000) * 100 +
    ((testInfo.workerIndex + counter) % 100)
  );
}

async function createDisposableDescriptionFixture(
  testInfo: TestInfo,
): Promise<DisposableDescriptionFixture> {
  const courseJwId = nextDisposableJwId(testInfo);
  const sectionJwId = nextDisposableJwId(testInfo);
  const marker = `e2e-description-fixture-${sectionJwId}`;
  const originalContent = `${marker}-original`;

  return withE2ePrisma((prisma) =>
    prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          code: marker,
          jwId: courseJwId,
          nameCn: marker,
        },
        select: { id: true },
      });
      const section = await tx.section.create({
        data: {
          code: marker,
          courseId: course.id,
          jwId: sectionJwId,
        },
        select: { id: true },
      });
      const description = await tx.description.create({
        data: {
          content: originalContent,
          sectionId: section.id,
        },
        select: { id: true },
      });

      return {
        courseId: course.id,
        descriptionId: description.id,
        originalContent,
        sectionId: section.id,
        sectionJwId,
      };
    }),
  );
}

async function deleteDisposableDescriptionFixture(
  fixture: DisposableDescriptionFixture,
) {
  await withE2ePrisma(async (prisma) => {
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: {
          targetId: fixture.descriptionId,
          targetType: "description",
        },
      }),
      prisma.descriptionEdit.deleteMany({
        where: { descriptionId: fixture.descriptionId },
      }),
      prisma.description.deleteMany({
        where: { id: fixture.descriptionId },
      }),
      prisma.section.deleteMany({ where: { id: fixture.sectionId } }),
      prisma.course.deleteMany({ where: { id: fixture.courseId } }),
    ]);
  });
}

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

test("/api/descriptions POST 登录后可更新描述并清理", async ({
  page,
}, testInfo) => {
  await signInAsDebugUser(page, "/");
  const fixture = await createDisposableDescriptionFixture(testInfo);
  let snapshot: Awaited<ReturnType<typeof snapshotDescriptionForE2e>> | null =
    null;

  try {
    // Read original content first
    const originalResponse = await page.request.get(
      `/api/descriptions?targetType=section&targetId=${fixture.sectionId}`,
    );
    expect(originalResponse.status()).toBe(200);
    const originalBody = (await originalResponse.json()) as {
      description?: { content?: string; id?: string | null } | null;
    };
    expect(originalBody.description?.id).toBe(fixture.descriptionId);
    expect(originalBody.description?.content).toBe(fixture.originalContent);
    snapshot = await snapshotDescriptionForE2e(fixture.descriptionId, [
      "description_edit",
    ]);

    const newContent = `e2e-description-${Date.now()}`;

    // POST: update description
    const postResponse = await page.request.post("/api/descriptions", {
      data: {
        targetType: "section",
        targetId: String(fixture.sectionId),
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
      `/api/descriptions?targetType=section&targetId=${fixture.sectionId}`,
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
        targetId: String(fixture.sectionId),
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
    if (snapshot) {
      await waitForDescriptionAuditRows(snapshot, 1);
    }
    await deleteDisposableDescriptionFixture(fixture);
  }
});

test("/api/descriptions POST accepts public section JW id", async ({
  page,
}, testInfo) => {
  await signInAsDebugUser(page, "/");
  const fixture = await createDisposableDescriptionFixture(testInfo);
  let snapshot: Awaited<ReturnType<typeof snapshotDescriptionForE2e>> | null =
    null;

  try {
    const originalResponse = await page.request.get(
      `/api/descriptions?targetType=section&sectionJwId=${fixture.sectionJwId}`,
    );
    expect(originalResponse.status()).toBe(200);
    const originalBody = (await originalResponse.json()) as {
      description?: { content?: string; id?: string | null } | null;
    };
    expect(originalBody.description?.id).toBe(fixture.descriptionId);
    expect(originalBody.description?.content).toBe(fixture.originalContent);
    snapshot = await snapshotDescriptionForE2e(fixture.descriptionId, [
      "description_edit",
    ]);

    const newContent = `e2e-description-public-id-${Date.now()}`;

    const postResponse = await page.request.post("/api/descriptions", {
      data: {
        targetType: "section",
        sectionJwId: fixture.sectionJwId,
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
      `/api/descriptions?targetType=section&sectionJwId=${fixture.sectionJwId}`,
    );
    expect(getResponse.status()).toBe(200);
    const getBody = (await getResponse.json()) as {
      description?: { content?: string } | null;
    };
    expect(getBody.description?.content).toContain(newContent);
  } finally {
    if (snapshot) {
      await waitForDescriptionAuditRows(snapshot, 1);
    }
    await deleteDisposableDescriptionFixture(fixture);
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
