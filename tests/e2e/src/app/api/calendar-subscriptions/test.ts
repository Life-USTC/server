/**
 * E2E tests for POST /api/calendar-subscriptions
 *
 * ## Endpoint
 * - `POST /api/calendar-subscriptions` — Replace the current user's subscribed sections
 *
 * ## Request
 * - Body: `{ sectionIds?: number[] }` (optional; omitting clears subscriptions)
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
 * - `sectionIds` is optional — omitting it clears all subscriptions
 * - Non-existent section IDs are silently dropped
 * - Invalid body types (e.g. string instead of array) return 400
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

const BASE = "/api/calendar-subscriptions";

test.describe("POST /api/calendar-subscriptions", () => {
  test.describe.configure({ mode: "serial" });

  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const response = await request.post(BASE, {
      data: { sectionIds: [1] },
    });
    expect(response.status()).toBe(401);
  });

  test("subscribes to seed section and returns correct shape", async ({
    page,
  }) => {
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

  test("omitting sectionIds clears subscriptions", async ({ page }) => {
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

  test("non-existent section IDs are silently dropped", async ({ page }) => {
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

  test("returns 400 for malformed body", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(BASE, {
      data: { sectionIds: "not-an-array" },
    });
    expect(response.status()).toBe(400);
  });
});
