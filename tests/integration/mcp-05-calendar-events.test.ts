import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("flexDateInputSchema — bare YYYY-MM-DD accepted by date-filter tools", () => {
  let originalSubscriptionSectionIds: number[] = [];

  beforeAll(async () => {
    originalSubscriptionSectionIds = await fixtures.getUserSubscribedSectionIds(
      context.devUserId,
    );
    await fixtures.ensureDevUserSubscribedToSeedSection(context.devUserId);
  });

  afterAll(async () => {
    await fixtures.replaceUserSubscribedSections(
      context.devUserId,
      originalSubscriptionSectionIds,
    );
  });

  it("list_my_schedules accepts bare date strings (no timezone offset)", async () => {
    const result = await context.client.call<{
      schedules?: Array<{
        id?: number;
        date?: string;
        endTime?: unknown;
        startTime?: unknown;
      }>;
    }>("list_my_schedules", {
      dateFrom: fixtures.SEED_DATE, // bare date — would have been rejected by old dateTimeSchema
      dateTo: fixtures.SEED_PLUS_ELEVEN_DAYS,
      limit: 20,
      locale: "zh-cn",
    });

    // Should not error, and the seeded schedules should be returned
    expect(Array.isArray(result.schedules)).toBe(true);
    expect((result.schedules?.length ?? 0) > 0).toBe(true);
    expect(typeof result.schedules?.[0]?.startTime).toBe("string");
    expect(typeof result.schedules?.[0]?.endTime).toBe("string");
    // Every date should fall within the requested window
    for (const schedule of result.schedules ?? []) {
      if (schedule.date) {
        expect(schedule.date >= fixtures.SEED_DATE).toBe(true);
        expect(schedule.date <= fixtures.SEED_PLUS_TWELVE_DAYS).toBe(true); // lte dateTo end-of-day
      }
    }
  });

  it("list_my_exams accepts bare date strings", async () => {
    const result = await context.client.call<{
      exams?: Array<{ id?: number }>;
    }>("list_my_exams", {
      dateFrom: fixtures.SEED_DATE,
      includeDateUnknown: false,
      limit: 20,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.exams)).toBe(true);
  });

  it("list_my_calendar_events accepts bare date strings", async () => {
    const result = await context.client.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("list_my_calendar_events", {
      dateFrom: fixtures.SEED_DATE,
      dateTo: fixtures.SEED_PLUS_ELEVEN_DAYS,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.events)).toBe(true);
    // Should include the seeded schedule events
    expect(
      (result.events ?? []).some((e) =>
        ["schedule", "homework_due", "exam", "todo_due"].includes(e.type ?? ""),
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events treats same-day bare date ranges as full Shanghai days", async () => {
    const result = await context.client.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("list_my_calendar_events", {
      dateFrom: fixtures.SEED_DATE,
      dateTo: fixtures.SEED_DATE,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.events)).toBe(true);
    expect(
      (result.events ?? []).some(
        (event) =>
          event.type === "schedule" && event.at?.startsWith(fixtures.SEED_DATE),
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events honors an exact inclusive dateTo bound", async () => {
    const dueAt = `${fixtures.SEED_PLUS_THREE_DAYS}T21:00:00+08:00`;
    const result = await context.client.call<{
      events?: Array<{ type?: string; at?: string }>;
    }>("list_my_calendar_events", {
      dateFrom: dueAt,
      dateTo: dueAt,
      locale: "zh-cn",
    });

    expect(
      (result.events ?? []).some(
        (event) => event.type === "homework_due" && event.at === dueAt,
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events includes todos at an exact inclusive dateTo bound", async () => {
    const dueAt = `${fixtures.SEED_DATE}T06:45:00+08:00`;
    const todo = await fixtures.prisma.todo.create({
      data: {
        userId: context.devUserId,
        title: "[integration-test] inclusive todo dueAt",
        dueAt: new Date(dueAt),
      },
      select: { id: true },
    });

    try {
      const result = await context.client.call<{
        events?: Array<{
          type?: string;
          at?: string;
          payload?: { id?: string };
        }>;
      }>("list_my_calendar_events", {
        dateFrom: dueAt,
        dateTo: dueAt,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) =>
            event.type === "todo_due" &&
            event.at === dueAt &&
            event.payload?.id === todo.id,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.todo.deleteMany({ where: { id: todo.id } });
    }
  });

  it("list_my_calendar_events includes timed events overlapping an exact window", async () => {
    const schedule = await fixtures.prisma.schedule.findFirst({
      where: {
        section: { jwId: fixtures.DEV_SEED.section.jwId },
        date: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
      },
      select: { id: true, startTime: true, endTime: true },
      orderBy: { startTime: "asc" },
    });
    if (!schedule) {
      throw new Error(`Seed schedule for ${fixtures.SEED_DATE} not found`);
    }

    const windowStart = fixtures.shanghaiIsoOnSeedDate(schedule.startTime, 15);
    const windowEnd = fixtures.shanghaiIsoOnSeedDate(schedule.startTime, 30);
    const endsAt = new Date(fixtures.shanghaiIsoOnSeedDate(schedule.endTime));
    expect(endsAt.getTime()).toBeGreaterThan(new Date(windowEnd).getTime());

    const result = await context.client.call<{
      events?: Array<{ type?: string; payload?: { id?: number } }>;
    }>("list_my_calendar_events", {
      dateFrom: windowStart,
      dateTo: windowEnd,
      locale: "zh-cn",
    });

    expect(
      (result.events ?? []).some(
        (event) =>
          event.type === "schedule" && event.payload?.id === schedule.id,
      ),
    ).toBe(true);
  });

  it("list_my_calendar_events widens date-backed queries for exact windows", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const jwId = 926042901;
    await fixtures.prisma.exam.deleteMany({ where: { jwId } });

    try {
      await fixtures.prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: null,
        },
      });

      const result = await context.client.call<{
        events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
      }>("list_my_calendar_events", {
        dateFrom: `${fixtures.SEED_DATE}T00:10:00+08:00`,
        dateTo: `${fixtures.SEED_DATE}T00:30:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) => event.type === "exam" && event.payload?.jwId === jwId,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("list_my_calendar_events keeps no-time exams visible through their day", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const jwId = 926042900;
    await fixtures.prisma.exam.deleteMany({ where: { jwId } });

    try {
      await fixtures.prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: null,
        },
      });

      const result = await context.client.call<{
        events?: Array<{ type?: string; at?: string }>;
      }>("list_my_calendar_events", {
        dateFrom: `${fixtures.SEED_DATE}T08:00:00+08:00`,
        dateTo: `${fixtures.SEED_DATE}T09:00:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) =>
            event.type === "exam" &&
            event.at === `${fixtures.SEED_DATE}T00:00:00+08:00`,
        ),
      ).toBe(true);
    } finally {
      await fixtures.prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("list_my_calendar_events respects endTime for exams without startTime", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    if (!section) {
      throw new Error(
        `Seed section ${fixtures.DEV_SEED.section.jwId} not found`,
      );
    }

    const jwId = 926042902;
    await fixtures.prisma.exam.deleteMany({ where: { jwId } });

    try {
      await fixtures.prisma.exam.create({
        data: {
          jwId,
          sectionId: section.id,
          examDate: new Date(`${fixtures.SEED_DATE}T00:00:00.000Z`),
          startTime: null,
          endTime: 1200,
        },
      });

      const result = await context.client.call<{
        events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
      }>("list_my_calendar_events", {
        dateFrom: `${fixtures.SEED_DATE}T13:00:00+08:00`,
        dateTo: `${fixtures.SEED_DATE}T14:00:00+08:00`,
        locale: "zh-cn",
      });

      expect(
        (result.events ?? []).some(
          (event) => event.type === "exam" && event.payload?.jwId === jwId,
        ),
      ).toBe(false);
    } finally {
      await fixtures.prisma.exam.deleteMany({ where: { jwId } });
    }
  });

  it("returns a descriptive error for a nonsense date string", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("list_my_schedules", {
      dateFrom: "not-a-date",
      limit: 5,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not-a-date");
    expect(result.message?.toLowerCase()).toContain("invalid");
  });
});

// ---------------------------------------------------------------------------
// atTime override — reproducible time-sensitive tools
// ---------------------------------------------------------------------------
