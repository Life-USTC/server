import { expect, vi } from "vitest";
import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import { getUserCalendarRecord } from "@/features/calendar/server/calendar-export-data";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import { listSubscribedHomeworks } from "@/features/subscriptions/server/subscription-read-model";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

vi.mock("@/features/calendar/server/ical-event-utils", async (original) => ({
  ...(await original<
    typeof import("@/features/calendar/server/ical-event-utils")
  >()),
  loadLocationAssets: async () => [
    { locations: [] },
    { manifest: { rooms: [] }, rules: [] },
  ],
}));
const now = new Date("2035-09-15T10:00:00+08:00");
const it = nodeProtocolTest.extend<{ clock: undefined }>({
  // The integration runner retains Vitest's isolated worker default. This file
  // owns one case and one global Date; it is not safe for same-realm concurrency.
  clock: [
    async ({ protocolRuntime }, use) => {
      try {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(now);
        await use(undefined);
      } finally {
        // A timeout can leave the admitted workflow running. Keep its clock
        // until requests and background cleanup finish. The owning runtime
        // fixture reports this same close promise's original failure afterward.
        await Promise.allSettled([protocolRuntime.close()]);
        vi.useRealTimers();
      }
    },
    { auto: true },
  ],
});

it("calendar.teaching-assistant-homework", async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
}) => {
  await protocolRuntime.run(async () => {
    const { user } = await db.$transaction(async (tx) => {
      const marker = crypto.randomUUID();
      const user = await tx.user.create({
        data: { email: `${marker}@ta-calendar.test`, name: "Calendar TA" },
      });
      const jwId = 1;
      const course = await tx.course.create({
        data: { jwId, code: marker, nameCn: "Calendar TA course" },
      });
      const section = await tx.section.create({
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
      for (const [title, dueAt, completed] of [
        ["ta-past", new Date(now.getTime() - 1), false],
        ["ta-boundary", now, false],
        ["ta-future", new Date(now.getTime() + 60_000), false],
        ["ta-undated", null, false],
        ["ta-completed", new Date(now.getTime() + 60_000), true],
      ] as const) {
        await tx.homework.create({
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
      return { user };
    });
    const completionAt = new Date(now.getTime() - 60_000);
    const pending = await protocolRuntime.request(() =>
      listSubscribedHomeworks(user.id, {
        completed: false,
        now,
      }),
    );
    expect(pending.map((item) => item.title).sort()).toEqual([
      "ta-future",
      "ta-undated",
    ]);
    const calendar = await protocolRuntime.request(() =>
      listUserCalendarEvents(user.id, {
        dateFrom: new Date(now.getTime() - 86_400_000),
        dateTo: new Date(now.getTime() + 86_400_000),
      }),
    );
    expect(
      calendar
        .filter((item) => item.type === "homework_due")
        .map((item) => item.payload.title),
    ).toEqual(["ta-future"]);
    const record = await protocolRuntime.request(() =>
      getUserCalendarRecord(user.id),
    );
    if (!record) throw new Error("Missing calendar owner");
    const exported = await protocolRuntime.request(() =>
      buildUserCalendarExport(record, user.id),
    );
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
  });
});
