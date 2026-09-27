import { afterAll, afterEach, expect, it, vi } from "vitest";
import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import { getUserCalendarRecord } from "@/features/calendar/server/calendar-export-data";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import { listSubscribedHomeworks } from "@/features/subscriptions/server/subscription-read-model";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

vi.mock("@/features/calendar/server/ical-event-utils", async (original) => ({
  ...(await original<
    typeof import("@/features/calendar/server/ical-event-utils")
  >()),
  loadLocationAssets: async () => [
    { locations: [] },
    { manifest: { rooms: [] }, rules: [] },
  ],
}));
const db = createFixturePrisma();
afterAll(async () => {
  await Promise.all([disconnectTestPrisma(db), runtimePrisma.$disconnect()]);
});
afterEach(() => vi.useRealTimers());

it("calendar.teaching-assistant-homework", async () => {
  const now = new Date("2035-09-15T10:00:00+08:00");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const marker = crypto.randomUUID();
  const user = await db.user.create({
    data: { email: `${marker}@ta-calendar.test`, name: "Calendar TA" },
  });
  const jwId = 2_144_000_000 + Math.floor(Math.random() * 100_000);
  const course = await db.course.create({
    data: { jwId, code: marker, nameCn: "Calendar TA course" },
  });
  const section = await db.section.create({
    data: {
      jwId,
      code: marker,
      courseId: course.id,
      sectionSubscriptions: {
        create: { userId: user.id, kind: "teaching_assistant" },
      },
    },
  });
  const completionAt = new Date(now.getTime() - 60_000);
  try {
    for (const [title, dueAt, completed] of [
      ["ta-past", new Date(now.getTime() - 1), false],
      ["ta-boundary", now, false],
      ["ta-future", new Date(now.getTime() + 60_000), false],
      ["ta-undated", null, false],
      ["ta-completed", new Date(now.getTime() + 60_000), true],
    ] as const) {
      await db.homework.create({
        data: {
          title,
          sectionId: section.id,
          createdById: user.id,
          submissionDueAt: dueAt,
          ...(completed
            ? {
                homeworkCompletions: {
                  create: { userId: user.id, completedAt: completionAt },
                },
              }
            : {}),
        },
      });
    }
    const pending = await listSubscribedHomeworks(user.id, {
      completed: false,
      now,
    });
    expect(pending.map((item) => item.title).sort()).toEqual([
      "ta-future",
      "ta-undated",
    ]);
    const calendar = await listUserCalendarEvents(user.id, {
      dateFrom: new Date(now.getTime() - 86_400_000),
      dateTo: new Date(now.getTime() + 86_400_000),
    });
    expect(
      calendar
        .filter((item) => item.type === "homework_due")
        .map((item) => item.payload.title),
    ).toEqual(["ta-future"]);
    const record = await getUserCalendarRecord(user.id);
    if (!record) throw new Error("Missing calendar owner");
    const exported = await buildUserCalendarExport(record, user.id);
    expect(exported.text).toContain("ta-future");
    for (const title of [
      "ta-past",
      "ta-boundary",
      "ta-undated",
      "ta-completed",
    ])
      expect(exported.text).not.toContain(title);
    const completions = await db.homeworkCompletion.findMany({
      where: { userId: user.id },
      select: { completedAt: true },
    });
    expect(completions).toEqual([{ completedAt: completionAt }]);
  } finally {
    await db.homeworkCompletion.deleteMany({ where: { userId: user.id } });
    await db.homework.deleteMany({ where: { sectionId: section.id } });
    await db.section.delete({ where: { id: section.id } });
    await db.course.delete({ where: { id: course.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
