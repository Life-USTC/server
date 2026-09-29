import { expect } from "@playwright/test";
import {
  calendarCatalog,
  test,
} from "../../../calendar-subscriptions/_fixture";

const path = (id: string) => `/api/calendar-feeds/${id}.ics`;

test("anonymous access without a feed token returns 401", async ({
  run,
  request,
}) => {
  await run(async () => {
    expect((await request.get(path(crypto.randomUUID()))).status()).toBe(401);
  });
});

test("unknown user with a feed token returns 404", async ({ run, request }) => {
  await run(async () => {
    expect(
      (
        await request.get(`${path(crypto.randomUUID())}?token=invalid-token`)
      ).status(),
    ).toBe(404);
  });
});

test("a session cannot read another existing user's calendar", async ({
  run,
  createActor,
}) => {
  await run(async () => {
    const owner = await createActor();
    const other = await createActor();
    expect((await other.request.get(path(owner.id))).status()).toBe(403);
  });
});

for (const mode of ["session", "path token", "query token"] as const) {
  test(`${mode} consumes known calendar state and excludes completed, deleted and foreign items`, async ({
    run,
    request,
    calendarState,
  }) => {
    await run(async () => {
      const { db, owner, other, section, scheduleGroupId } = calendarState;
      const token = crypto.randomUUID();
      await db.user.update({
        where: { id: owner.id },
        data: { calendarFeedToken: token },
      });
      await db.userSectionSubscription.create({
        data: { userId: owner.id, sectionId: section.id },
      });
      const schedule = await db.schedule.create({
        data: {
          sectionId: section.id,
          scheduleGroupId,
          date: new Date("2026-04-29"),
          weekday: 3,
          startTime: 900,
          endTime: 1000,
          periods: 2,
          weekIndex: 1,
          startUnit: 1,
          endUnit: 2,
        },
      });
      await db.exam.create({
        data: {
          jwId: section.jwId,
          sectionId: section.id,
          examDate: new Date("2026-04-30"),
          examType: 1,
          startTime: 1400,
          endTime: 1600,
        },
      });
      await db.homework.createMany({
        data: [
          {
            sectionId: section.id,
            title: "visible homework",
            submissionDueAt: new Date("2026-05-01"),
          },
          {
            sectionId: section.id,
            title: "deleted homework",
            submissionDueAt: new Date("2026-05-01"),
            deletedAt: new Date(),
          },
          { sectionId: section.id, title: "undated homework" },
        ],
      });
      const completed = await db.homework.create({
        data: {
          sectionId: section.id,
          title: "completed homework",
          submissionDueAt: new Date("2026-05-01"),
        },
      });
      await db.homeworkCompletion.create({
        data: { userId: owner.id, homeworkId: completed.id },
      });
      await db.todo.createMany({
        data: [
          {
            userId: owner.id,
            title: "visible todo",
            dueAt: new Date("2026-05-01"),
          },
          {
            userId: owner.id,
            title: "completed todo",
            dueAt: new Date("2026-05-01"),
            completed: true,
          },
          { userId: owner.id, title: "undated todo" },
          {
            userId: other.id,
            title: "foreign todo",
            dueAt: new Date("2026-05-01"),
          },
        ],
      });
      const response =
        mode === "session"
          ? await owner.request.get(path(owner.id))
          : await request.get(
              mode === "path token"
                ? `/api/calendar-feeds/${owner.id}:${token}.ics`
                : `${path(owner.id)}?token=${token}`,
            );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/calendar");
      expect(response.headers()["cache-control"]).toBe("private, no-store");
      const text = (await response.text()).replace(/\r?\n[ \t]/g, "");
      expect(text).toContain("BEGIN:VCALENDAR");
      expect(text).toContain("END:VCALENDAR");
      expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(4);
      expect(text).toContain(`/schedule/${schedule.id}`);
      expect(text).toContain(`${calendarCatalog.courseNameCn} - 期中考试`);
      expect(text).toContain("visible homework");
      expect(text).toContain("visible todo");
      for (const hidden of [
        "deleted homework",
        "completed homework",
        "undated homework",
        "completed todo",
        "undated todo",
        "foreign todo",
        token,
      ])
        expect(text).not.toContain(hidden);
      const stamps = text
        .split(/\r?\n/)
        .filter((line) => line.startsWith("DTSTAMP:"));
      expect(stamps).toHaveLength(4);
      for (const stamp of stamps)
        expect(stamp).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
    });
  });
}

test("invalid or revoked token returns private 410 even with the owner's session", async ({
  run,
  isolatedWorker,
  request,
  createActor,
}) => {
  await run(async () => {
    const owner = await createActor();
    const db = isolatedWorker.database.owner;

    await db.user.update({
      where: { id: owner.id },
      data: { calendarFeedToken: crypto.randomUUID() },
    });
    for (const reader of [request, owner.request]) {
      const response = await reader.get(
        `${path(owner.id)}?token=revoked-token`,
      );
      expect(response.status()).toBe(410);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
    }
  });
});

test("valid anonymous token returns an empty VCALENDAR for a new user", async ({
  run,
  isolatedWorker,
  request,
  createActor,
}) => {
  await run(async () => {
    const owner = await createActor();
    const token = crypto.randomUUID();
    const db = isolatedWorker.database.owner;

    await db.user.update({
      where: { id: owner.id },
      data: { calendarFeedToken: token },
    });
    const response = await request.get(
      `/api/calendar-feeds/${owner.id}:${token}.ics`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");
    const text = await response.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("END:VCALENDAR");
    expect(text).not.toContain("BEGIN:VEVENT");
  });
});
