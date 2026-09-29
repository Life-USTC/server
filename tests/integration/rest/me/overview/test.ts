import { expect } from "@playwright/test";
import { test } from "../../calendar-subscriptions/_fixture";

const base = "/api/workspace/overview";
const atTime = "2026-04-29T12:00:00+08:00";

test("anonymous overview returns JSON 401", async ({ run, request }) => {
  await run(async () => {
    const response = await request.get(base);
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

test("overview counts known state independently of sample limits and excludes past or unknown exams", async ({
  run,
  calendarState,
}) => {
  await run(async () => {
    const { db, owner, other, section, second, scheduleGroupId } =
      calendarState;
    await db.user.update({
      where: { id: owner.id },
      data: { name: "Overview owner" },
    });
    await db.userSectionSubscription.create({
      data: { userId: owner.id, sectionId: section.id },
    });
    await db.schedule.createMany({
      data: [900, 1400].map((startTime) => ({
        sectionId: section.id,
        scheduleGroupId,
        date: new Date("2026-04-29"),
        weekday: 3,
        startTime,
        endTime: startTime + 100,
        periods: 2,
        weekIndex: 1,
        startUnit: 1,
        endUnit: 2,
      })),
    });
    await db.todo.createMany({
      data: [
        {
          userId: owner.id,
          title: "priority todo",
          priority: "high",
          dueAt: new Date("2026-04-30"),
        },
        {
          userId: owner.id,
          title: "overdue todo",
          priority: "low",
          dueAt: new Date("2026-04-28"),
        },
        { userId: owner.id, title: "undated todo", priority: "low" },
        { userId: owner.id, title: "completed todo", completed: true },
        {
          userId: other.id,
          title: "foreign todo",
          priority: "high",
          dueAt: new Date("2026-04-30"),
        },
      ],
    });
    const dueHomework = await db.homework.create({
      data: {
        sectionId: section.id,
        title: "next homework",
        submissionDueAt: new Date("2026-04-30"),
      },
    });
    await db.homework.createMany({
      data: [
        {
          sectionId: section.id,
          title: "second homework",
          submissionDueAt: new Date("2026-05-01"),
        },
        {
          sectionId: section.id,
          title: "overdue homework",
          submissionDueAt: new Date("2026-04-28"),
        },
        {
          sectionId: section.id,
          title: "future homework",
          submissionDueAt: new Date("2026-06-01"),
        },
        {
          sectionId: section.id,
          title: "deleted homework",
          submissionDueAt: new Date("2026-04-30"),
          deletedAt: new Date(),
        },
      ],
    });
    const completed = await db.homework.create({
      data: {
        sectionId: section.id,
        title: "completed homework",
        submissionDueAt: new Date("2026-04-30"),
      },
    });
    await db.homeworkCompletion.createMany({
      data: [
        { userId: owner.id, homeworkId: completed.id },
        { userId: other.id, homeworkId: dueHomework.id },
      ],
    });
    await db.exam.createMany({
      data: [
        {
          jwId: section.jwId,
          sectionId: section.id,
          examDate: new Date("2026-04-29"),
          startTime: 1400,
          endTime: 1600,
        },
        {
          jwId: section.jwId + 1,
          sectionId: section.id,
          examDate: new Date("2026-04-30"),
          startTime: 1400,
          endTime: 1600,
        },
        {
          jwId: section.jwId + 2,
          sectionId: section.id,
          examDate: new Date("2026-04-29"),
          startTime: 900,
          endTime: 1000,
        },
        {
          jwId: section.jwId + 3,
          sectionId: section.id,
          examDate: null,
          startTime: 900,
          endTime: 1000,
        },
        {
          jwId: section.jwId + 4,
          sectionId: second.id,
          examDate: new Date("2026-04-30"),
          startTime: 1400,
          endTime: 1600,
        },
      ],
    });
    const response = await owner.request.get(
      `${base}?atTime=${encodeURIComponent(atTime)}&homeworkWindowDays=7&limit=1`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user).toMatchObject({
      userId: owner.id,
      name: "Overview owner",
    });
    expect(body.anchor).toMatchObject({ homeworkWindowDays: 7, limit: 1 });
    expect(body.counts).toMatchObject({
      todos: { incomplete: 3, completed: 1, overdue: 1 },
      pendingHomeworks: 4,
      dueSoonHomeworks: 2,
      todaySchedules: 2,
      upcomingExams: 2,
    });
    expect(body.schedules).toMatchObject({
      total: 2,
      items: [
        expect.objectContaining({
          section: expect.objectContaining({ code: section.code }),
        }),
      ],
    });
    expect(body.todos.items).toEqual([
      expect.objectContaining({ title: "overdue todo" }),
    ]);
    expect(body.dueTodos).toMatchObject({
      total: 1,
      items: [
        expect.objectContaining({
          title: "priority todo",
          dueAt: expect.any(String),
        }),
      ],
    });
    expect(body.homeworks).toMatchObject({
      total: 2,
      items: [
        expect.objectContaining({ id: dueHomework.id, title: "next homework" }),
      ],
    });
    expect(body.exams).toMatchObject({
      total: 2,
      items: [expect.objectContaining({ jwId: section.jwId })],
    });
  });
});

test("a new user's overview has zero counts and empty samples", async ({
  run,
  createActor,
}) => {
  await run(async () => {
    const owner = await createActor();
    const response = await owner.request.get(
      `${base}?atTime=${encodeURIComponent(atTime)}`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.counts).toMatchObject({
      todos: { incomplete: 0, completed: 0, overdue: 0 },
      pendingHomeworks: 0,
      dueSoonHomeworks: 0,
      todaySchedules: 0,
      upcomingExams: 0,
    });
    for (const name of ["schedules", "todos", "dueTodos", "homeworks", "exams"])
      expect(body[name].items).toEqual([]);
  });
});

test("date-only overview anchor is the start of the Shanghai day", async ({
  run,
  createActor,
}) => {
  await run(async () => {
    const owner = await createActor();
    const response = await owner.request.get(
      `${base}?atTime=2026-04-29&limit=3`,
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).anchor.atTime).toBe(
      "2026-04-29T00:00:00+08:00",
    );
  });
});

test("invalid overview anchor returns 400", async ({ run, createActor }) => {
  await run(async () => {
    const owner = await createActor();
    const response = await owner.request.get(`${base}?atTime=not-a-date`);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});
