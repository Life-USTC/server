/**
 * E2E tests for GET /api/community/users/[userId]/calendar.ics
 *
 * ## Endpoint
 * - `GET /api/community/users/:userId/calendar.ics` — Generate iCalendar feed for a user's subscriptions
 *
 * ## Auth Modes
 * - Session auth: must be the same user (own calendar only)
 * - Token auth via path: `/api/community/users/:userId::token/calendar.ics`
 * - Token auth via query: `/api/community/users/:userId/calendar.ics?token=X`
 *
 * ## Response
 * - 200: `text/calendar; charset=utf-8` with iCalendar data
 * - 401: unauthorized (no session and no token)
 * - 403: forbidden (wrong user or invalid token)
 * - 404: user not found or no calendar items
 *
 * ## Content
 * - Includes subscribed section schedules and exams
 * - Includes incomplete homework with due dates
 * - Includes todos with due dates (excludes completed)
 * - Returns 404 if user has no calendar items at all
 *
 * ## Edge Cases
 * - Path token format: `userId:token` in the [userId] segment
 * - Invalid token for an existing user returns 403
 * - Accessing another user's calendar via session returns 403
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../../utils/auth";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import {
  createTempUsersFixture,
  deleteUsersByPrefix,
  ensureUserCalendarFeedFixture,
  getCurrentSessionUser,
} from "../../../../../../utils/e2e-db";
import {
  assertApiContract,
  expectCalendarDtstampsAreUtc,
} from "../../../../_shared/api-contract";

const ROUTE_PATH = "/api/community/users/[userId]/calendar.ics";

function unfoldICalendar(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

test.describe("GET /api/community/users/[userId]/calendar.ics", () => {
  test.describe.configure({ mode: "serial" });

  test("契约", async ({ request }) => {
    await assertApiContract(request, { routePath: ROUTE_PATH });
  });

  test("未认证且无 token 时返回 401", async ({ request }) => {
    const response = await request.get(
      "/api/community/users/invalid-e2e/calendar.ics",
    );
    expect(response.status()).toBe(401);
  });

  test("无效 token 返回 403", async ({ request }) => {
    const response = await request.get(
      "/api/community/users/invalid-e2e/calendar.ics?token=invalid-token",
    );
    expect(response.status()).toBe(403);
  });

  test("访问其他用户日历时返回 403", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(
      "/api/community/users/not-the-current-user/calendar.ics",
    );
    expect(response.status()).toBe(403);
  });

  test("通过 session 认证返回有效的个人 iCalendar", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const { id: userId } = await getCurrentSessionUser(page);

    const currentRes = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const currentBody = (await currentRes.json()) as {
      subscription?: { sections?: Array<{ id?: number }> } | null;
    };
    const originalIds =
      currentBody.subscription?.sections?.map((s) => s.id as number) ?? [];

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

    try {
      await page.request.post("/api/workspace/subscriptions", {
        data: { sectionIds: [seedSection.id] },
      });

      const response = await page.request.get(
        `/api/community/users/${userId}/calendar.ics`,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/calendar");

      const body = await response.text();
      const unfoldedBody = unfoldICalendar(body);
      expect(body.trim().length).toBeGreaterThan(0);
      expect(unfoldedBody).toContain("BEGIN:VCALENDAR");
      expectCalendarDtstampsAreUtc(body);

      // Seed data should include homework, todos, and exam events
      expect(unfoldedBody).toContain(DEV_SEED.homeworks.title);
      expect(unfoldedBody).toContain(DEV_SEED.todos.dueTodayTitle);
      expect(unfoldedBody).toContain(`${DEV_SEED.course.nameCn} - 期中考试`);

      // Completed todos and deleted homework must not appear
      expect(unfoldedBody).not.toContain(DEV_SEED.todos.completedTitle);
      expect(unfoldedBody).not.toContain("已删除作业");
    } finally {
      await page.request.post("/api/workspace/subscriptions", {
        data: { sectionIds: originalIds },
      });
    }
  });

  test("通过 path token 返回有效的 iCalendar（匿名）", async ({
    page,
    request,
  }) => {
    await signInAsDebugUser(page, "/");
    const { id: userId } = await getCurrentSessionUser(page);
    const feed = await ensureUserCalendarFeedFixture(userId);

    // Request with path token, no session
    const response = await request.get(feed.path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");

    const body = await response.text();
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body).toContain("BEGIN:VCALENDAR");
  });

  test("通过 query token 返回有效的 iCalendar（匿名）", async ({
    page,
    request,
  }) => {
    await signInAsDebugUser(page, "/");
    const { id: userId } = await getCurrentSessionUser(page);
    const feed = await ensureUserCalendarFeedFixture(userId);

    // Request with query param token instead of path token
    const response = await request.get(
      `/api/community/users/${userId}/calendar.ics?token=${feed.token}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");

    const body = await response.text();
    expect(body).toContain("BEGIN:VCALENDAR");
  });

  test("现有用户无效 token 返回 403", async ({ page, request }) => {
    await signInAsDebugUser(page, "/");
    const { id: userId } = await getCurrentSessionUser(page);

    const response = await request.get(
      `/api/community/users/${userId}/calendar.ics?token=bogus-token-e2e`,
    );
    expect(response.status()).toBe(403);
  });

  test("有效 token 在没有日历项目时返回空 iCalendar", async ({ request }) => {
    const prefix = `e2e-empty-calendar-${Date.now()}`;
    const { userIds } = await createTempUsersFixture({ prefix, count: 1 });
    const userId = userIds[0];
    if (!userId) {
      throw new Error("Expected temporary calendar user");
    }

    try {
      const feed = await ensureUserCalendarFeedFixture(userId);
      const response = await request.get(feed.path);

      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/calendar");
      const body = await response.text();
      expect(body).toContain("BEGIN:VCALENDAR");
      expect(body).toContain("END:VCALENDAR");
      expect(body).not.toContain("BEGIN:VEVENT");
    } finally {
      await deleteUsersByPrefix(prefix);
    }
  });
});
