/**
 * E2E tests for GET /api/me/overview
 *
 * Authenticated compact overview for lightweight clients. The response combines
 * schedule, todo, homework, and exam samples without client-side fan-out.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../../../utils/dev-seed";
import { withE2ePrisma } from "../../../../../utils/e2e-db/prisma";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/me/overview";
const PAST_SAME_DAY_EXAM_JW_ID = 88_051_001;
const UNKNOWN_DATE_EXAM_JW_ID = 88_051_002;

test.describe("GET /api/me/overview", () => {
  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("returns compact counts and top items", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(
      `${BASE}?atTime=${encodeURIComponent(DEV_SEED.seedAnchorAtTime)}&homeworkWindowDays=7&limit=3`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      anchor?: { homeworkWindowDays?: number; limit?: number };
      counts?: {
        todos?: { incomplete?: number; overdue?: number };
        pendingHomeworks?: number;
        dueSoonHomeworks?: number;
        todaySchedules?: number;
        upcomingExams?: number;
      };
      schedules?: {
        total?: number;
        items?: Array<{ section?: { code?: string } }>;
      };
      todos?: { items?: Array<{ title?: string }> };
      dueTodos?: { items?: Array<{ title?: string; dueAt?: string }> };
      homeworks?: { items?: Array<{ title?: string }> };
      exams?: { items?: Array<{ section?: { code?: string } }> };
      user?: { userId?: string; name?: string | null };
    };

    expect(body.user?.name).toBe(DEV_SEED.debugName);
    expect(body.anchor?.homeworkWindowDays).toBe(7);
    expect(body.anchor?.limit).toBe(3);
    expect((body.counts?.todos?.incomplete ?? 0) > 0).toBe(true);
    expect((body.counts?.pendingHomeworks ?? 0) > 0).toBe(true);
    expect((body.counts?.todaySchedules ?? 0) > 0).toBe(true);
    expect((body.counts?.upcomingExams ?? 0) > 0).toBe(true);
    expect(
      body.schedules?.items?.some(
        (schedule) => schedule.section?.code === DEV_SEED.section.code,
      ),
    ).toBe(true);
    expect(
      body.todos?.items?.some(
        (todo) => todo.title === DEV_SEED.todos.dueTodayTitle,
      ),
    ).toBe(true);
    expect(
      body.dueTodos?.items?.some(
        (todo) =>
          todo.title === DEV_SEED.todos.dueTodayTitle &&
          typeof todo.dueAt === "string",
      ),
    ).toBe(true);
    expect((body.homeworks?.items?.length ?? 0) > 0).toBe(true);
    expect((body.exams?.items?.length ?? 0) > 0).toBe(true);
  });

  test("excludes same-day exams that already ended", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const atTime = "2026-04-29T12:00:00+08:00";
    const url = `${BASE}?atTime=${encodeURIComponent(atTime)}&limit=30`;
    const beforeResponse = await page.request.get(url);
    expect(beforeResponse.status()).toBe(200);
    const beforeBody = (await beforeResponse.json()) as {
      counts?: { upcomingExams?: number };
    };

    await withE2ePrisma(async (prisma) => {
      const section = await prisma.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { id: true },
      });
      await prisma.exam.upsert({
        where: { jwId: PAST_SAME_DAY_EXAM_JW_ID },
        update: {
          examDate: new Date("2026-04-29T00:00:00.000Z"),
          endTime: 1000,
          examMode: "closed",
          examTakeCount: 1,
          examType: 1,
          sectionId: section.id,
          startTime: 900,
        },
        create: {
          jwId: PAST_SAME_DAY_EXAM_JW_ID,
          examDate: new Date("2026-04-29T00:00:00.000Z"),
          endTime: 1000,
          examMode: "closed",
          examTakeCount: 1,
          examType: 1,
          sectionId: section.id,
          startTime: 900,
        },
      });
    });

    try {
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        counts?: { upcomingExams?: number };
        exams?: { items?: Array<{ jwId?: number }> };
      };

      expect(body.counts?.upcomingExams).toBe(beforeBody.counts?.upcomingExams);
      expect(
        body.exams?.items?.some(
          (exam) => exam.jwId === PAST_SAME_DAY_EXAM_JW_ID,
        ),
      ).toBe(false);
    } finally {
      await withE2ePrisma((prisma) =>
        prisma.exam.deleteMany({
          where: { jwId: PAST_SAME_DAY_EXAM_JW_ID },
        }),
      );
    }
  });

  test("excludes date-unknown exams from upcoming counts", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const url = `${BASE}?atTime=${encodeURIComponent(DEV_SEED.seedAnchorAtTime)}&limit=30`;
    const beforeResponse = await page.request.get(url);
    expect(beforeResponse.status()).toBe(200);
    const beforeBody = (await beforeResponse.json()) as {
      counts?: { upcomingExams?: number };
    };

    await withE2ePrisma(async (prisma) => {
      const section = await prisma.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { id: true },
      });
      await prisma.exam.upsert({
        where: { jwId: UNKNOWN_DATE_EXAM_JW_ID },
        update: {
          endTime: 1000,
          examDate: null,
          examMode: "closed",
          examTakeCount: 1,
          examType: 1,
          sectionId: section.id,
          startTime: 900,
        },
        create: {
          jwId: UNKNOWN_DATE_EXAM_JW_ID,
          endTime: 1000,
          examDate: null,
          examMode: "closed",
          examTakeCount: 1,
          examType: 1,
          sectionId: section.id,
          startTime: 900,
        },
      });
    });

    try {
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        counts?: { upcomingExams?: number };
        exams?: { items?: Array<{ jwId?: number }> };
      };

      expect(body.counts?.upcomingExams).toBe(beforeBody.counts?.upcomingExams);
      expect(
        body.exams?.items?.some(
          (exam) => exam.jwId === UNKNOWN_DATE_EXAM_JW_ID,
        ),
      ).toBe(false);
    } finally {
      await withE2ePrisma((prisma) =>
        prisma.exam.deleteMany({
          where: { jwId: UNKNOWN_DATE_EXAM_JW_ID },
        }),
      );
    }
  });

  test("treats date-only atTime as Shanghai day start", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(
      `${BASE}?atTime=${DEV_SEED_ANCHOR.date}&limit=3`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      anchor?: { atTime?: string };
    };

    expect(body.anchor?.atTime).toBe(DEV_SEED.seedAnchorAtTime);
  });

  test("invalid atTime returns 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(`${BASE}?atTime=not-a-date`);
    expect(response.status()).toBe(400);
  });
});
