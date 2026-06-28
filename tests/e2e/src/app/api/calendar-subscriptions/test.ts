/**
 * E2E tests for the calendar subscription API
 *
 * ## Endpoints
 * - `POST /api/calendar-subscriptions` — Replace the current user's subscribed sections
 * - `PATCH /api/calendar-subscriptions` — Append selected section IDs
 * - `DELETE /api/calendar-subscriptions` — Remove selected section IDs
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
import { resolveSeedSectionMatches } from "../../../../utils/seed-lookups";
import { assertApiContract } from "../../_shared/api-contract";

const BASE = "/api/calendar-subscriptions";
const IMPORT_BASE = "/api/calendar-subscriptions/import-codes";

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
      "/api/calendar-subscriptions/current",
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
      "/api/calendar-subscriptions/current",
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

  test("remove sections 删除指定 id 且不替换并发添加", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const [firstSection, secondSection] = await resolveSeedSectionMatches(page);
    expect(firstSection?.id).toBeDefined();
    expect(secondSection?.id).toBeDefined();

    const currentRes = await page.request.get(
      "/api/calendar-subscriptions/current",
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

    const matchRes = await page.request.post("/api/sections/match-codes", {
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
    const currentRes = await page.request.get(
      "/api/calendar-subscriptions/current",
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
      "/api/calendar-subscriptions/current",
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

    const matchRes = await page.request.post("/api/sections/match-codes", {
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

    const currentRes = await page.request.get(
      "/api/calendar-subscriptions/current",
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
