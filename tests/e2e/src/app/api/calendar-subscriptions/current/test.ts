/**
 * E2E tests for GET /api/calendar-subscriptions/current
 *
 * ## Endpoint
 * - `GET /api/calendar-subscriptions/current` — Get the current user's subscribed sections
 *
 * ## Response
 * - 200: `{ subscription: { userId: string, sections: { id: number }[] } }`
 * - 200: `{ subscription: null }` when user record is missing
 * - 401: unauthorized when not signed in
 *
 * ## Auth Requirements
 * - Requires session authentication
 *
 * ## Edge Cases
 * - The dev seed user already has subscribed sections from seed data
 * - Returns subscription: null only if user row itself is missing (unlikely in normal flow)
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/calendar-subscriptions/current";

test.describe("GET /api/calendar-subscriptions/current", () => {
  test.describe.configure({ mode: "serial" });

  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("returns subscription with seed section for authenticated user", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/");

    // Resolve seed section ID
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

    const response = await page.request.get(BASE);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      subscription?: {
        userId?: string;
        note?: string | null;
        sections?: Array<{ id?: number }>;
        calendarPath?: string;
        calendarUrl?: string;
      } | null;
    };
    expect(body.subscription).not.toBeNull();
    expect(body.subscription?.userId).toBeTruthy();
    expect(Array.isArray(body.subscription?.sections)).toBe(true);
    expect(
      body.subscription?.sections?.some((s) => s.id === seedSection?.id),
    ).toBe(true);

    // Verify CalendarSubscription fields
    const sub = body.subscription as Record<string, unknown>;
    expect(Object.hasOwn(sub, "note")).toBe(true);
    expect(typeof sub.calendarPath).toBe("string");
    expect((sub.calendarPath as string).startsWith("/api/users/")).toBe(true);
    expect(typeof sub.calendarUrl).toBe("string");
    expect((sub.calendarUrl as string).startsWith("http")).toBe(true);
    expect(sub.calendarUrl as string).toContain("/api/users/");
    expect(sub.calendarUrl as string).not.toContain("/api/auth/api/users/");
  });

  test("reflects changes made via POST", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    // Save original state
    const originalRes = await page.request.get(BASE);
    const originalBody = (await originalRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      originalBody.subscription?.sections?.map((s) => s.id as number) ?? [];

    try {
      // Clear subscriptions
      await page.request.post("/api/calendar-subscriptions", {
        data: { sectionIds: [] },
      });

      const emptyRes = await page.request.get(BASE);
      expect(emptyRes.status()).toBe(200);
      const emptyBody = (await emptyRes.json()) as {
        subscription?: { sections?: Array<{ id?: number }> } | null;
      };
      expect(emptyBody.subscription?.sections).toEqual([]);
    } finally {
      // Restore original subscriptions
      await page.request.post("/api/calendar-subscriptions", {
        data: { sectionIds: originalIds },
      });
    }
  });
});
