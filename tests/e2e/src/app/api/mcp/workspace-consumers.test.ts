import { expect } from "@playwright/test";
import {
  anchor,
  arrangeAcademic,
  arrangeBus,
  arrangeHomework,
  arrangeSection,
  facts,
} from "./_data";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

test("MCP workspace consumers project independently prepared state", async ({
  mcp,
  oauth,
}) => {
  const db = oauth.worker.database.owner;
  const userId = oauth.user.id;
  const section = await arrangeAcademic(db);
  const homework = await arrangeHomework(db, userId, section.id);
  const schedule = await db.schedule.findFirstOrThrow({
    where: { sectionId: section.id },
  });
  const exam = await db.exam.findFirstOrThrow({
    where: { sectionId: section.id },
  });
  await db.userSectionSubscription.create({
    data: { userId, sectionId: section.id },
  });
  const todo = await db.todo.create({
    data: {
      userId,
      title: facts.todos.dueTodayTitle,
      dueAt: new Date("2026-04-29T15:00:00+08:00"),
    },
  });
  await db.todo.create({
    data: { userId, title: facts.todos.completedTitle, completed: true },
  });
  await arrangeBus(db);
  await db.busUserPreference.create({
    data: {
      userId,
      preferredOriginCampusId: 1,
      preferredDestinationCampusId: 2,
    },
  });

  // Expected identities come from arrangement; expectations never use another reader.
  const events = [
    {
      type: "schedule",
      at: "2026-04-29T09:00:00+08:00",
      payload: { id: schedule.id },
    },
    {
      type: "homework_due",
      at: "2026-04-29T12:00:00+08:00",
      payload: { id: homework.id },
    },
    { type: "exam", at: "2026-04-29T13:00:00+08:00", payload: { id: exam.id } },
    {
      type: "todo_due",
      at: "2026-04-29T15:00:00+08:00",
      payload: { id: todo.id },
    },
  ];
  async function read(name: string, args: Record<string, unknown> = {}) {
    const result = await mcp.callTool({ name, arguments: args });
    expect(result.isError).not.toBe(true);
    return parseTextContent(result);
  }
  const todos = await read("workspace_todo_list");
  expect(todos.counts).toMatchObject({ incomplete: 1, completed: 1 });
  expect(todos.todos).toMatchObject([
    { id: todo.id, title: facts.todos.dueTodayTitle, completed: false },
  ]);

  const homeworks = await read("workspace_homework_list", {
    completed: false,
    limit: 30,
    locale: "zh-cn",
  });
  expect(homeworks.homeworks).toMatchObject([
    {
      id: homework.id,
      title: facts.homeworks.title,
      completion: null,
      commentCount: 0,
    },
  ]);
  const schedules = await read("workspace_schedule_list", {
    limit: 30,
    locale: "zh-cn",
  });
  expect(schedules.schedules).toMatchObject([{ id: schedule.id }]);
  const exams = await read("workspace_exam_list", {
    includeDateUnknown: true,
    limit: 30,
    locale: "zh-cn",
  });
  expect(exams.exams).toMatchObject([{ id: exam.id }]);

  const reference = { atTime: anchor.recommendedAtTime, locale: "zh-cn" };
  const overview = await read("workspace_overview_get", {
    ...reference,
    limit: 2,
  });
  expect(overview.overview).toEqual({
    pendingTodosCount: 1,
    pendingHomeworksCount: 1,
    todaySchedulesCount: 1,
    upcomingExamsCount: 1,
  });
  expect(overview.samples).toMatchObject({
    dueTodos: [{ id: todo.id }],
    dueHomeworks: [{ id: homework.id }],
    upcomingExams: [{ id: exam.id }],
  });
  const overviewDefault = await read("workspace_overview_get", {
    ...reference,
    limit: 2,
    mode: "default",
  });
  expect(overviewDefault).toEqual(overview);

  const snapshot = await read("workspace_snapshot_get", reference);
  expect(snapshot).toMatchObject({
    currentSemester: { code: "421" },
    subscriptions: {
      totalCount: 1,
      currentSemesterCount: 1,
      currentSemesterSectionsTotal: 1,
      currentSemesterSections: [{ jwId: section.jwId }],
    },
    nextClass: events[0],
    upcomingDeadlines: { total: 3, items: events.slice(1) },
    todos: { incompleteCount: 1, items: [{ id: todo.id }] },
    bus: { hasPreference: true, nextDeparture: { routeId: facts.bus.routeId } },
  });
  expect(snapshot.nextClass).not.toHaveProperty("payload.scheduleGroup");
  expect(snapshot.nextClass).not.toHaveProperty("payload.roomType");
  const snapshotDefault = await read("workspace_snapshot_get", {
    ...reference,
    mode: "default",
  });
  expect(snapshotDefault).toEqual(snapshot);

  const nextClass = await read("workspace_schedule_next", reference);
  expect(nextClass).toMatchObject({ found: true, nextClass: events[0] });
  const deadlines = await read("workspace_deadline_list", {
    ...reference,
    dayLimit: 7,
  });
  expect(deadlines).toMatchObject({ total: 3, deadlines: events.slice(1) });

  const timelineArgs = { locale: "zh-cn", atTime: anchor.startOfDayAtTime };
  const timeline = await read("workspace_calendar_timeline_get", timelineArgs);
  expect(timeline).toMatchObject({
    total: 4,
    range: {
      from: "2026-04-29T00:00:00+08:00",
      to: "2026-05-06T00:00:00+08:00",
    },
    events,
  });
  const timelineDefault = await read("workspace_calendar_timeline_get", {
    ...timelineArgs,
    mode: "default",
  });
  expect(timelineDefault).toEqual(timeline);
  const calendarArgs = {
    dateFrom: anchor.startOfDayAtTime,
    dateTo: "2026-05-10T23:59:59+08:00",
    locale: "zh-cn",
  };
  const calendar = await read("workspace_calendar_event_list", calendarArgs);
  expect(calendar.events).toMatchObject(events);
  const calendarDefault = await read("workspace_calendar_event_list", {
    ...calendarArgs,
    mode: "default",
  });
  expect(calendarDefault).toEqual(calendar);
});

test("MCP calendar feed consumer exposes current membership without credentials", async ({
  mcp,
  oauth,
}) => {
  const db = oauth.worker.database.owner;
  const userId = oauth.user.id;
  const section = await arrangeSection(db);
  // This endpoint uses server time, unlike the explicitly anchored agenda reads.
  const year = new Date().getUTCFullYear();
  await db.semester.update({
    where: { jwId: facts.semesterJwId },
    data: {
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year + 1, 0, 1)),
    },
  });
  await db.userSectionSubscription.create({
    data: { userId, sectionId: section.id },
  });
  async function read(name: string, args: Record<string, unknown>) {
    const result = await mcp.callTool({ name, arguments: args });
    expect(result.isError).not.toBe(true);
    return parseTextContent(result);
  }
  const feed = await read("workspace_calendar_feed_get", { locale: "zh-cn" });
  expect(feed).toMatchObject({
    success: true,
    subscription: {
      userId,
      sectionCount: 1,
      currentSemesterSectionCount: 1,
      currentSemesterSections: [{ id: section.id }],
    },
  });
  expect(feed.subscription).not.toHaveProperty("sections");
  expect(feed.subscription).not.toHaveProperty("calendarPath");
  expect(feed.subscription).not.toHaveProperty("calendarUrl");
  const feedDefault = await read("workspace_calendar_feed_get", {
    locale: "zh-cn",
    mode: "default",
  });
  expect(feedDefault).toEqual(feed);
});
