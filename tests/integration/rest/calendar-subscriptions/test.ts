/**
 * E2E tests for the calendar subscription API
 *
 * ## Endpoints
 * - `PATCH /api/workspace/subscriptions` — Append selected section IDs
 * - `DELETE /api/workspace/subscriptions` — Remove selected section IDs
 *
 * ## Request
 * - PATCH Body: `{ sectionIds: number[] }`
 * - DELETE Body: `{ sectionIds: number[] }`
 *
 * ## Response
 * - 200: `{ subscription: { userId: string, sections: { id: number }[] } }`
 * - 400: validation error for malformed body
 * - 401: unauthorized when not signed in
 *
 * ## Auth Requirements
 * - Requires session authentication
 *
 * ## Edge Cases
 * - Unknown positive section IDs are silently dropped
 * - Invalid body types (e.g. string instead of array) return 400
 */
import { expect, test } from "@playwright/test";
import { calendarSubscriptionBatchResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import {
  getCurrentSessionUser,
  getSeedSectionSemesterFixture,
} from "../../../e2e/utils/e2e-db";
import { withE2ePrisma } from "../../../e2e/utils/e2e-db/prisma";
import { resolveSeedSectionMatches } from "../../../e2e/utils/seed-lookups";
import { assertSubscriptionBrief } from "../../../shared/scenarios/subscriptions";
import { signInAsDebugUserApi } from "../_harness/auth";
import { assertApiContract } from "../_shared/api-contract";

const BASE = "/api/workspace/subscriptions";
const BATCH_BASE = "/api/workspace/subscriptions/batch";
const IMPORT_BASE = "/api/workspace/subscriptions/import-codes";

test.describe("日历订阅 API", () => {
  test.describe.configure({ mode: "serial" });

  test("接口契约", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("import-codes 接口契约", async ({ request }) => {
    await assertApiContract(request, { routePath: IMPORT_BASE });
  });

  test("未登录时返回 401", async ({ request }) => {
    const response = await request.patch(BASE, {
      data: { sectionIds: [1] },
    });
    expect(response.status()).toBe(401);
  });

  test("import-codes 未登录时返回 401", async ({ request }) => {
    const response = await request.post(IMPORT_BASE, {
      data: { codes: [DEV_SEED.section.code] },
    });
    expect(response.status()).toBe(401);
  });

  test("append sections 未登录时返回 401", async ({ request }) => {
    const response = await request.patch(BASE, {
      data: { sectionIds: [1] },
    });
    expect(response.status()).toBe(401);
  });

  test("未登录的带 body PATCH 重复请求始终返回 401", async ({ request }) => {
    for (let index = 0; index < 20; index += 1) {
      const headers =
        index % 2 === 0
          ? {
              "x-life-public-ssr": "1",
              "x-life-public-ssr-locale": "en-us",
              "x-life-public-ssr-mode": "page",
              "x-life-ustc-request-id": "client-controlled-internal-id",
              "x-request-id": "client-controlled-id",
            }
          : undefined;
      const response = await request.patch(BASE, {
        data: { sectionIds: [1] },
        headers,
      });
      expect(response.status()).toBe(401);
    }
  });

  test("remove sections 未登录时返回 401", async ({ request }) => {
    const response = await request.delete(BASE, {
      data: { sectionIds: [1] },
    });
    expect(response.status()).toBe(401);
  });

  test("append sections 格式错误的 section id 返回 400", async ({
    request,
  }) => {
    await signInAsDebugUserApi(request, "/");

    const response = await request.patch(BASE, {
      data: { sectionIds: [0] },
    });

    expect(response.status()).toBe(400);
  });

  test("remove sections 格式错误的 section id 返回 400", async ({
    request,
  }) => {
    await signInAsDebugUserApi(request, "/");

    const response = await request.delete(BASE, {
      data: { sectionIds: [0] },
    });

    expect(response.status()).toBe(400);
  });

  test("import-codes 追加匹配的课程代码并报告重复", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const currentRes = await request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      await request.delete(BASE, { data: { sectionIds: originalIds } });

      const firstResponse = await request.post(IMPORT_BASE, {
        data: {
          codes: [DEV_SEED.section.code, "MISSING.CODE"],
        },
      });
      expect(firstResponse.status()).toBe(200);
      const firstBody = (await firstResponse.json()) as {
        addedCount?: number;
        addedSections?: Array<{ id?: number; code?: string }>;
        alreadySubscribedCount?: number;
        matchedCodes?: string[];
        subscription?: { sections?: Array<{ id?: number; code?: string }> };
        unmatchedCodes?: string[];
      };

      expect(firstBody.matchedCodes).toContain(DEV_SEED.section.code);
      expect(firstBody.unmatchedCodes).toContain("MISSING.CODE");
      expect(firstBody.addedCount).toBe(1);
      expect(firstBody.alreadySubscribedCount).toBe(0);
      expect(firstBody.addedSections?.[0]?.code).toBe(DEV_SEED.section.code);
      expect(
        firstBody.subscription?.sections?.some(
          (section) => section.code === DEV_SEED.section.code,
        ),
      ).toBe(true);

      const secondResponse = await request.post(IMPORT_BASE, {
        data: { codes: [DEV_SEED.section.code] },
      });
      expect(secondResponse.status()).toBe(200);
      const secondBody = (await secondResponse.json()) as {
        addedCount?: number;
        alreadySubscribedCount?: number;
        alreadySubscribedSections?: Array<{ code?: string }>;
      };
      expect(secondBody.addedCount).toBe(0);
      expect(secondBody.alreadySubscribedCount).toBe(1);
      expect(secondBody.alreadySubscribedSections?.[0]?.code).toBe(
        DEV_SEED.section.code,
      );
    } finally {
      await request.patch(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("append sections 添加指定 id 且不替换已有订阅", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");
    const [firstSection, secondSection] =
      await resolveSeedSectionMatches(request);
    expect(firstSection?.id).toBeDefined();
    expect(secondSection?.id).toBeDefined();

    const currentRes = await request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      await request.delete(BASE, { data: { sectionIds: originalIds } });
      await request.patch(BASE, { data: { sectionIds: [firstSection.id] } });

      const unknownPositiveSectionId = 999_999_999;
      const response = await request.patch(BASE, {
        data: { sectionIds: [secondSection.id, unknownPositiveSectionId] },
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        addedCount?: number;
        alreadySubscribedCount?: number;
        subscription?: { sections?: Array<{ id?: number }> };
      };

      expect(body.addedCount).toBe(1);
      expect(body.alreadySubscribedCount).toBe(0);
      assertSubscriptionBrief(body.subscription, { expectSections: true });
      const sectionIds = body.subscription?.sections?.map((s) => s.id) ?? [];
      expect(sectionIds).toContain(firstSection.id);
      expect(sectionIds).toContain(secondSection.id);
      expect(sectionIds).not.toContain(unknownPositiveSectionId);

      const repeatResponse = await request.patch(BASE, {
        data: { sectionIds: [secondSection.id] },
      });
      expect(repeatResponse.status()).toBe(200);
      const repeatBody = (await repeatResponse.json()) as {
        addedCount?: number;
        alreadySubscribedCount?: number;
      };
      expect(repeatBody.addedCount).toBe(0);
      expect(repeatBody.alreadySubscribedCount).toBe(1);
    } finally {
      await request.delete(BASE, {
        data: { sectionIds: [firstSection.id, secondSection.id] },
      });
      await request.patch(BASE, { data: { sectionIds: originalIds } });
    }
  });

  test("追加操作保留已有退役班级且不能重新添加", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");
    const sessionUser = await getCurrentSessionUser(request);
    const previous = await withE2ePrisma(async (prisma) => {
      const [section, user] = await Promise.all([
        prisma.section.findUniqueOrThrow({
          where: { jwId: DEV_SEED.section.jwId },
          select: { id: true, retiredAt: true, semesterId: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { id: sessionUser.id },
          select: {
            sectionSubscriptions: {
              orderBy: { sectionId: "asc" },
              select: { sectionId: true },
            },
          },
        }),
      ]);
      return {
        section,
        subscribedSectionIds: user.sectionSubscriptions.map(
          (subscription) => subscription.sectionId,
        ),
      };
    });

    await withE2ePrisma((prisma) =>
      prisma.$transaction([
        prisma.section.update({
          where: { id: previous.section.id },
          data: { retiredAt: new Date("2026-01-01T00:00:00.000Z") },
        }),
        prisma.user.update({
          where: { id: sessionUser.id },
          data: {
            sectionSubscriptions: {
              deleteMany: {},
              create: [{ sectionId: previous.section.id }],
            },
          },
        }),
      ]),
    );

    try {
      if (previous.section.semesterId == null) {
        throw new Error(
          "Expected retired test section to belong to a semester",
        );
      }

      const appendResponse = await request.patch(BASE, {
        data: { sectionIds: [previous.section.id] },
      });
      expect(appendResponse.status()).toBe(200);
      const appendBody = (await appendResponse.json()) as {
        addedCount?: number;
        alreadySubscribedCount?: number;
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(appendBody.addedCount).toBe(0);
      expect(appendBody.alreadySubscribedCount).toBe(0);
      expect(
        appendBody.subscription?.sections?.map((section) => section.id),
      ).toContain(previous.section.id);

      const batchResponse = await request.post(BATCH_BASE, {
        data: {
          action: "add",
          sectionIds: [previous.section.id],
          semesterId: previous.section.semesterId,
        },
      });
      expect(batchResponse.status()).toBe(200);
      const batchBody = (await batchResponse.json()) as {
        addedCount?: number;
        matchedSectionIds?: number[];
        subscription?: { sections?: Array<{ id?: number }> };
        unchangedCount?: number;
        unmatchedSectionIds?: number[];
      };
      expect(batchBody.addedCount).toBe(0);
      expect(batchBody.unchangedCount).toBe(0);
      expect(batchBody.matchedSectionIds).toEqual([]);
      expect(batchBody.unmatchedSectionIds).toEqual([previous.section.id]);
      expect(
        batchBody.subscription?.sections?.map((section) => section.id),
      ).toContain(previous.section.id);

      const removeResponse = await request.delete(BASE, {
        data: { sectionIds: [previous.section.id] },
      });
      expect(removeResponse.status()).toBe(200);
      const removeBody = (await removeResponse.json()) as {
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(
        removeBody.subscription?.sections?.map((section) => section.id),
      ).not.toContain(previous.section.id);

      const reAddResponse = await request.post(BATCH_BASE, {
        data: {
          action: "add",
          sectionIds: [previous.section.id],
          semesterId: previous.section.semesterId,
        },
      });
      expect(reAddResponse.status()).toBe(200);
      const reAddBody = (await reAddResponse.json()) as {
        matchedSectionIds?: number[];
        subscription?: { sections?: Array<{ id?: number }> };
        unmatchedSectionIds?: number[];
      };
      expect(reAddBody.matchedSectionIds).toEqual([]);
      expect(reAddBody.unmatchedSectionIds).toEqual([previous.section.id]);
      expect(
        reAddBody.subscription?.sections?.map((section) => section.id),
      ).not.toContain(previous.section.id);
    } finally {
      await withE2ePrisma((prisma) =>
        prisma.$transaction([
          prisma.section.update({
            where: { id: previous.section.id },
            data: { retiredAt: previous.section.retiredAt },
          }),
          prisma.user.update({
            where: { id: sessionUser.id },
            data: {
              sectionSubscriptions: {
                deleteMany: {},
                create: previous.subscribedSectionIds.map((sectionId) => ({
                  sectionId,
                })),
              },
            },
          }),
        ]),
      );
    }
  });

  test("batch add 追加指定学期班级且保留其他学期订阅", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");
    const [currentSection, previousSection] = await Promise.all([
      getSeedSectionSemesterFixture(DEV_SEED.section.jwId),
      getSeedSectionSemesterFixture(DEV_SEED.previousSection.jwId),
    ]);
    if (
      currentSection.semesterId === null ||
      previousSection.semesterId === null
    ) {
      throw new Error("Expected seed sections to belong to semesters");
    }
    expect(currentSection.semesterId).not.toBe(previousSection.semesterId);

    const currentRes = await request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map(
        (section) => section.id as number,
      ) ?? [];

    try {
      await request.delete(BASE, { data: { sectionIds: originalIds } });

      const currentResponse = await request.post(BATCH_BASE, {
        data: {
          action: "add",
          sectionIds: [currentSection.id],
          semesterId: currentSection.semesterId,
        },
      });
      expect(currentResponse.status()).toBe(200);
      const currentResult = calendarSubscriptionBatchResponseSchema.parse(
        await currentResponse.json(),
      );
      expect(currentResult.addedCount).toBe(1);
      expect(currentResult.removedCount).toBe(0);

      const previousResponse = await request.post(BATCH_BASE, {
        data: {
          action: "add",
          sectionIds: [previousSection.id],
          semesterId: previousSection.semesterId,
        },
      });
      expect(previousResponse.status()).toBe(200);
      const previousResult = calendarSubscriptionBatchResponseSchema.parse(
        await previousResponse.json(),
      );
      expect(previousResult.addedCount).toBe(1);
      expect(previousResult.removedCount).toBe(0);

      const repeatResponse = await request.post(BATCH_BASE, {
        data: {
          action: "add",
          sectionIds: [currentSection.id],
          semesterId: currentSection.semesterId,
        },
      });
      expect(repeatResponse.status()).toBe(200);
      const repeatResult = calendarSubscriptionBatchResponseSchema.parse(
        await repeatResponse.json(),
      );
      expect(repeatResult.addedCount).toBe(0);
      expect(repeatResult.unchangedCount).toBe(1);

      const finalResponse = await request.get(
        "/api/workspace/subscriptions/current",
      );
      const finalBody = (await finalResponse.json()) as {
        subscription?: { sections?: Array<{ id?: number }> } | null;
      };
      const finalIds =
        finalBody.subscription?.sections?.map((section) => section.id) ?? [];
      expect(finalIds).toContain(currentSection.id);
      expect(finalIds).toContain(previousSection.id);
    } finally {
      await request.delete(BASE, {
        data: { sectionIds: [currentSection.id, previousSection.id] },
      });
      await request.patch(BASE, { data: { sectionIds: originalIds } });
    }
  });

  test("remove sections 删除指定 id 且不替换并发添加", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");
    const [firstSection, secondSection] =
      await resolveSeedSectionMatches(request);
    expect(firstSection?.id).toBeDefined();
    expect(secondSection?.id).toBeDefined();

    const currentRes = await request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      await request.delete(BASE, {
        data: { sectionIds: originalIds },
      });
      await request.patch(BASE, {
        data: { sectionIds: [firstSection.id] },
      });
      await request.patch(BASE, {
        data: { sectionIds: [secondSection.id] },
      });

      const response = await request.delete(BASE, {
        data: { sectionIds: [firstSection.id] },
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        subscription?: { sections?: Array<{ id?: number }> };
      };
      const sectionIds = body.subscription?.sections?.map((s) => s.id) ?? [];
      expect(sectionIds).not.toContain(firstSection.id);
      expect(sectionIds).toContain(secondSection.id);
    } finally {
      await request.delete(BASE, {
        data: { sectionIds: [firstSection.id, secondSection.id] },
      });
      await request.patch(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("订阅 seed 课程并返回正确结构", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const matchRes = await request.post("/api/catalog/sections/match-codes", {
      data: { codes: [DEV_SEED.section.code] },
    });
    expect(matchRes.status()).toBe(200);
    const matchBody = (await matchRes.json()) as {
      sections?: Array<{ id?: number; code?: string | null }>;
    };
    const seedSection = matchBody.sections?.find(
      (s) => s.code === DEV_SEED.section.code,
    );
    expect(seedSection?.id).toBeDefined();
    if (seedSection?.id == null) {
      throw new Error("Expected seed section id");
    }
    const sectionId = seedSection.id;

    // Save current subscriptions for restoration
    const currentRes = await request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      const response = await request.patch(BASE, {
        data: { sectionIds: [sectionId] },
      });
      expect(response.status()).toBe(200);

      const body = (await response.json()) as {
        subscription?: {
          userId?: string;
          sections?: Array<{ id?: number }>;
        };
      };
      expect(body.subscription?.userId).toBeTruthy();
      expect(Array.isArray(body.subscription?.sections)).toBe(true);
      expect(body.subscription?.sections?.some((s) => s.id === sectionId)).toBe(
        true,
      );
    } finally {
      await request.delete(BASE, {
        data: { sectionIds: [sectionId] },
      });
      await request.patch(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("省略 sectionIds 返回 400", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const response = await request.delete(BASE, { data: {} });
    expect(response.status()).toBe(400);
  });

  test("不存在的 section ID 被静默忽略", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const matchRes = await request.post("/api/catalog/sections/match-codes", {
      data: { codes: [DEV_SEED.section.code] },
    });
    const matchBody = (await matchRes.json()) as {
      sections?: Array<{ id?: number; code?: string | null }>;
    };
    const seedSection = matchBody.sections?.find(
      (s) => s.code === DEV_SEED.section.code,
    );
    expect(seedSection?.id).toBeDefined();
    if (seedSection?.id == null) {
      throw new Error("Expected seed section id");
    }
    const validId = seedSection.id;
    const bogusId = 999_999_999;

    const currentRes = await request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      const response = await request.patch(BASE, {
        data: { sectionIds: [validId, bogusId] },
      });
      expect(response.status()).toBe(200);

      const body = (await response.json()) as {
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(body.subscription?.sections?.some((s) => s.id === validId)).toBe(
        true,
      );
      expect(body.subscription?.sections?.some((s) => s.id === bogusId)).toBe(
        false,
      );
    } finally {
      await request.delete(BASE, {
        data: { sectionIds: [validId] },
      });
      await request.patch(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("格式错误的请求体返回 400", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const response = await request.patch(BASE, {
      data: { sectionIds: "not-an-array" },
    });
    expect(response.status()).toBe(400);
  });
});
