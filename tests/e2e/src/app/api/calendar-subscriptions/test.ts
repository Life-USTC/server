/**
 * E2E tests for the calendar subscription API
 *
 * ## Endpoints
 * - `POST /api/workspace/subscriptions` — Replace the current user's subscribed sections
 * - `PATCH /api/workspace/subscriptions` — Append selected section IDs
 * - `DELETE /api/workspace/subscriptions` — Remove selected section IDs
 *
 * ## Request
 * - POST Body: `{ sectionIds?: number[] }` (optional; omitting clears subscriptions)
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
 * - POST `sectionIds` is optional — omitting it clears all subscriptions
 * - Unknown positive section IDs are silently dropped
 * - Invalid body types (e.g. string instead of array) return 400
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  getCurrentSessionUser,
  getSeedSectionSemesterFixture,
} from "../../../../utils/e2e-db";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { resolveSeedSectionMatches } from "../../../../utils/seed-lookups";
import { assertApiContract } from "../../_shared/api-contract";

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
    const response = await request.post(BASE, {
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

  test("remove sections 未登录时返回 401", async ({ request }) => {
    const response = await request.delete(BASE, {
      data: { sectionIds: [1] },
    });
    expect(response.status()).toBe(401);
  });

  test("append sections 格式错误的 section id 返回 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.patch(BASE, {
      data: { sectionIds: [0] },
    });

    expect(response.status()).toBe(400);
  });

  test("remove sections 格式错误的 section id 返回 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.delete(BASE, {
      data: { sectionIds: [0] },
    });

    expect(response.status()).toBe(400);
  });

  test("import-codes 追加匹配的课程代码并报告重复", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const currentRes = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      await page.request.post(BASE, { data: { sectionIds: [] } });

      const firstResponse = await page.request.post(IMPORT_BASE, {
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

      const secondResponse = await page.request.post(IMPORT_BASE, {
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
      await page.request.post(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("append sections 添加指定 id 且不替换已有订阅", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const [firstSection, secondSection] = await resolveSeedSectionMatches(page);
    expect(firstSection?.id).toBeDefined();
    expect(secondSection?.id).toBeDefined();

    const currentRes = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      await page.request.post(BASE, {
        data: { sectionIds: [firstSection.id] },
      });

      const unknownPositiveSectionId = 999_999_999;
      const response = await page.request.patch(BASE, {
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
      const sectionIds = body.subscription?.sections?.map((s) => s.id) ?? [];
      expect(sectionIds).toContain(firstSection.id);
      expect(sectionIds).toContain(secondSection.id);
      expect(sectionIds).not.toContain(unknownPositiveSectionId);

      const repeatResponse = await page.request.patch(BASE, {
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
      await page.request.post(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("set 只替换指定学期并保留往期订阅", async ({ page }) => {
    await signInAsDebugUser(page, "/");
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

    const currentRes = await page.request.get(
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
      const setupResponse = await page.request.post(BASE, {
        data: { sectionIds: [currentSection.id, previousSection.id] },
      });
      expect(setupResponse.status()).toBe(200);

      const unscopedSetResponse = await page.request.post(BATCH_BASE, {
        data: { action: "set", sectionIds: [] },
      });
      expect(unscopedSetResponse.status()).toBe(400);
      const preservedBody = (await (
        await page.request.get("/api/workspace/subscriptions/current")
      ).json()) as {
        subscription?: { sections?: Array<{ id?: number }> } | null;
      };
      const preservedIds =
        preservedBody.subscription?.sections?.map((section) => section.id) ??
        [];
      expect(preservedIds).toContain(currentSection.id);
      expect(preservedIds).toContain(previousSection.id);

      const currentSemesterId = currentSection.semesterId;

      const response = await page.request.post(BATCH_BASE, {
        data: {
          action: "set",
          sectionIds: [],
          semesterId: currentSemesterId,
        },
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        removedCount?: number;
        subscription?: { sections?: Array<{ id?: number }> };
      };
      const subscribedIds =
        body.subscription?.sections?.map((section) => section.id) ?? [];

      expect(body.removedCount).toBe(1);
      expect(subscribedIds).not.toContain(currentSection.id);
      expect(subscribedIds).toContain(previousSection.id);

      const wrongSemesterResponse = await page.request.post(BATCH_BASE, {
        data: {
          action: "set",
          sectionIds: [previousSection.id],
          semesterId: currentSemesterId,
        },
      });
      expect(wrongSemesterResponse.status()).toBe(200);
      const wrongSemesterBody = (await wrongSemesterResponse.json()) as {
        matchedSectionIds?: number[];
        unmatchedSectionIds?: number[];
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(wrongSemesterBody.matchedSectionIds).toEqual([]);
      expect(wrongSemesterBody.unmatchedSectionIds).toEqual([
        previousSection.id,
      ]);
      expect(
        wrongSemesterBody.subscription?.sections?.map((section) => section.id),
      ).toContain(previousSection.id);
    } finally {
      await page.request.post(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("replace 和 set 保留请求中已有的退役班级但不能重新添加", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/");
    const sessionUser = await getCurrentSessionUser(page);
    const previous = await withE2ePrisma(async (prisma) => {
      const [section, user] = await Promise.all([
        prisma.section.findUniqueOrThrow({
          where: { jwId: DEV_SEED.section.jwId },
          select: { id: true, retiredAt: true, semesterId: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { id: sessionUser.id },
          select: {
            subscribedSections: {
              orderBy: { id: "asc" },
              select: { id: true },
            },
          },
        }),
      ]);
      return {
        section,
        subscribedSectionIds: user.subscribedSections.map(
          (subscribedSection) => subscribedSection.id,
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
            subscribedSections: { set: [{ id: previous.section.id }] },
          },
        }),
      ]),
    );

    try {
      if (previous.section.semesterId == null) {
        throw new Error(
          "Expected retired test Section to belong to a semester",
        );
      }
      const replaceResponse = await page.request.post(BASE, {
        data: { sectionIds: [previous.section.id] },
      });
      expect(replaceResponse.status()).toBe(200);
      const replaceBody = (await replaceResponse.json()) as {
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(
        replaceBody.subscription?.sections?.map((section) => section.id),
      ).toContain(previous.section.id);

      const setResponse = await page.request.post(BATCH_BASE, {
        data: {
          action: "set",
          sectionIds: [previous.section.id],
          semesterId: previous.section.semesterId,
        },
      });
      expect(setResponse.status()).toBe(200);
      const setBody = (await setResponse.json()) as {
        matchedSectionIds?: number[];
        removedCount?: number;
        sections?: Array<{ id?: number }>;
        total?: number;
        unchangedCount?: number;
        unmatchedSectionIds?: number[];
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(setBody.matchedSectionIds).toEqual([previous.section.id]);
      expect(setBody.unmatchedSectionIds).toEqual([]);
      expect(setBody.removedCount).toBe(0);
      expect(setBody.unchangedCount).toBe(1);
      expect(setBody.sections?.map((section) => section.id)).toEqual([
        previous.section.id,
      ]);
      expect(setBody.total).toBe(1);
      expect(
        setBody.subscription?.sections?.map((section) => section.id),
      ).toContain(previous.section.id);

      const omitResponse = await page.request.post(BATCH_BASE, {
        data: {
          action: "set",
          sectionIds: [],
          semesterId: previous.section.semesterId,
        },
      });
      expect(omitResponse.status()).toBe(200);
      const omitBody = (await omitResponse.json()) as {
        removedCount?: number;
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(omitBody.removedCount).toBe(1);
      expect(
        omitBody.subscription?.sections?.map((section) => section.id),
      ).not.toContain(previous.section.id);

      const setReAddResponse = await page.request.post(BATCH_BASE, {
        data: {
          action: "set",
          sectionIds: [previous.section.id],
          semesterId: previous.section.semesterId,
        },
      });
      expect(setReAddResponse.status()).toBe(200);
      const setReAddBody = (await setReAddResponse.json()) as {
        matchedSectionIds?: number[];
        unchangedCount?: number;
        unmatchedSectionIds?: number[];
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(setReAddBody.matchedSectionIds).toEqual([]);
      expect(setReAddBody.unmatchedSectionIds).toEqual([previous.section.id]);
      expect(setReAddBody.unchangedCount).toBe(0);
      expect(
        setReAddBody.subscription?.sections?.map((section) => section.id),
      ).not.toContain(previous.section.id);

      const replaceReAddResponse = await page.request.post(BASE, {
        data: { sectionIds: [previous.section.id] },
      });
      expect(replaceReAddResponse.status()).toBe(200);
      const replaceReAddBody = (await replaceReAddResponse.json()) as {
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(
        replaceReAddBody.subscription?.sections?.map((section) => section.id),
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
              subscribedSections: {
                set: previous.subscribedSectionIds.map((id) => ({ id })),
              },
            },
          }),
        ]),
      );
    }
  });

  test("remove sections 删除指定 id 且不替换并发添加", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const [firstSection, secondSection] = await resolveSeedSectionMatches(page);
    expect(firstSection?.id).toBeDefined();
    expect(secondSection?.id).toBeDefined();

    const currentRes = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      await page.request.post(BASE, {
        data: { sectionIds: [firstSection.id] },
      });
      await page.request.patch(BASE, {
        data: { sectionIds: [secondSection.id] },
      });

      const response = await page.request.delete(BASE, {
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
      await page.request.post(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("订阅 seed 课程并返回正确结构", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const matchRes = await page.request.post(
      "/api/catalog/sections/match-codes",
      {
        data: { codes: [DEV_SEED.section.code] },
      },
    );
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
    const currentRes = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      const response = await page.request.post(BASE, {
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
      await page.request.post(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("省略 sectionIds 清空订阅", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    // Save current subscriptions for restoration
    const currentRes = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      const response = await page.request.post(BASE, { data: {} });
      expect(response.status()).toBe(200);

      const body = (await response.json()) as {
        subscription?: { sections?: Array<{ id?: number }> };
      };
      expect(body.subscription?.sections).toEqual([]);
    } finally {
      await page.request.post(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("不存在的 section ID 被静默忽略", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const matchRes = await page.request.post(
      "/api/catalog/sections/match-codes",
      {
        data: { codes: [DEV_SEED.section.code] },
      },
    );
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

    const currentRes = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      const response = await page.request.post(BASE, {
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
      await page.request.post(BASE, {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("格式错误的请求体返回 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(BASE, {
      data: { sectionIds: "not-an-array" },
    });
    expect(response.status()).toBe(400);
  });
});
