import { expect } from "@playwright/test";
import { prepareCalendarRead, readCalendarState } from "../../../../utils/calendar-read-observation";
import { test } from "../../../../utils/private-calendar-fixture";

type CalendarEvent = { payload: { id: string | number } };
type SnapshotResult = {
  nextClass: unknown;
  upcomingDeadlines: { total: number; items: CalendarEvent[] };
};
type NextClassResult = { found: boolean; nextClass: unknown };
type DeadlinesResult = { total: number; deadlines: CalendarEvent[] };
type OverviewResult = {
  overview: { upcomingExamsCount: number };
  samples: { upcomingExams: { id: number }[] };
};
test("overview.upcoming-exam-counts", async ({
  page,
  createCalendar,
  calendarProtocolRun,
  oauthOwner,
  isolatedWorker,
}) => {
  await calendarProtocolRun(async (io) => {
  const db = isolatedWorker.database.owner;
  const fixture = await createCalendar();
  const reader = await prepareCalendarRead(page, oauthOwner, io, fixture, {
    name: "overview-contract",
    scopes: ["workspace.overview:read", "workspace.schedule:read"],
    tools: [["workspace_overview_get", "workspace.overview"]],
    usage: [["workspace.overview", 1]],
  });
  await reader.authorize();
  const { call } = reader;
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const exams = await db.$transaction(async (tx) => {
    await tx.exam.deleteMany({ where: { sectionId: fixture.section.id } });
    const records = [];
    for (const [index, values] of [
      {
        examDate: new Date(todayDate.getTime() - 86400000),
        startTime: 900,
        endTime: 1000,
      },
      { examDate: null, startTime: 900, endTime: 1000 },
      { examDate: todayDate, startTime: null, endTime: null },
      { examDate: todayDate, startTime: 0, endTime: 2359 },
      { examDate: todayDate, startTime: 2359, endTime: null },
      {
        examDate: new Date(todayDate.getTime() + 86400000),
        startTime: 900,
        endTime: 1000,
      },
    ].entries()) {
      records.push(
        await tx.exam.create({
          data: {
            sectionId: fixture.section.id,
            jwId: fixture.section.jwId + index + 200,
            examMode: `exam-count-${index}`,
            ...values,
          },
        }),
      );
    }
    return records;
  });
  const expectedState = await readCalendarState(db);
  // Shell bootstrap accepts no request time and uses the actual Worker clock.
  // Crossing Shanghai midnight here remains a limit of this current-day case;
  // the shell's original four-exam assertion must still hold.
  const shell = await page.request.get("/_internal/shell-bootstrap");
  expect(shell.status()).toBe(200);
  expect((await shell.json()).navigation.examsCount).toBe(4);
  const rest = await page.request.get(
    `/api/workspace/overview?atTime=${encodeURIComponent(now.toISOString())}&limit=10`,
  );
  expect(rest.status()).toBe(200);
  const overview = await rest.json();
  expect(overview.counts.upcomingExams).toBe(4);
  expect(
    overview.exams.items.map((exam: { id: number }) => exam.id).sort(),
  ).toEqual(
    exams
      .slice(2)
      .map((exam) => exam.id)
      .sort(),
  );
  const mcp = await call<OverviewResult>("workspace_overview_get", {
    atTime: now.toISOString(),
    limit: 10,
    mode: "full",
  });
  expect(mcp.overview.upcomingExamsCount).toBe(4);
  expect(
    mcp.samples.upcomingExams.map((exam: { id: number }) => exam.id).sort(),
  ).toEqual(
    exams
      .slice(2)
      .map((exam) => exam.id)
      .sort(),
  );
  const gql = await page.request.post("/api/graphql", {
    headers: { origin: isolatedWorker.origin },
    data: {
      query:
        "query($atTime: DateTime!) { workspace { overview(atTime: $atTime) { upcomingExams } } }",
      variables: { atTime: now.toISOString() },
    },
  });
  const graph = await gql.json();
  expect(graph.errors).toBeUndefined();
  expect(graph.data.workspace.overview.upcomingExams).toBe(4);
  return reader.checks(expectedState);
  });
});

test("overview.focused-extracts-share-window", async ({
  page,
  createCalendar,
  calendarProtocolRun,
  oauthOwner,
  isolatedWorker,
}) => {
  await calendarProtocolRun(async (io) => {
  const db = isolatedWorker.database.owner;
  const fixture = await createCalendar();
  const atTime = "2026-04-29T08:00:00+08:00";
  const start = new Date(atTime).getTime();
  const day = 86400000;
  const edgeTodos = await db.$transaction(async (tx) => {
    const created = [];
    for (const [label, offset] of [
      ["before", -1],
      ["start", 0],
      ["inside", 7 * day - 1],
      ["end", 7 * day],
      ["outside", 8 * day],
    ] as const) {
      created.push(
        await tx.todo.create({
          data: {
            userId: fixture.users[0].id,
            title: `Window ${label}`,
            dueAt: new Date(start + offset),
          },
        }),
      );
    }
    return created;
  });
  const expectedState = await readCalendarState(db);
  expectedState.schedules = expectedState.schedules.map((schedule) => ({
    ...schedule, date: new Date("2026-05-06T00:00:00Z"),
  }));
  const reader = await prepareCalendarRead(page, oauthOwner, io, fixture, {
    name: "overview-contract",
    scopes: ["workspace.overview:read", "workspace.schedule:read"],
    tools: [
      "workspace_snapshot_get", "workspace_schedule_next",
      "workspace_snapshot_get", "workspace_schedule_next",
      "workspace_snapshot_get", "workspace_deadline_list",
      "workspace_deadline_list", "workspace_deadline_list",
      "workspace_snapshot_get", "workspace_snapshot_get", "workspace_schedule_next",
    ].map((name) => [name, "workspace.overview"] as const),
    usage: [["workspace.overview", 11]],
  });
  await reader.authorize();
  const { call } = reader;
  for (const mode of ["default", "full"]) {
    const snapshot = await call<SnapshotResult>("workspace_snapshot_get", {
      atTime,
      mode,
    });
    const next = await call<NextClassResult>("workspace_schedule_next", {
      atTime,
      mode,
    });
    expect(next.found).toBe(true);
    expect(next.nextClass).toEqual(snapshot.nextClass);
    expect(JSON.stringify(next.nextClass)).toContain(
      "2026-04-29T09:00:00+08:00",
    );
  }
  const snapshot = await call<SnapshotResult>("workspace_snapshot_get", {
    atTime,
    mode: "full",
  });
  const deadlines = await call<DeadlinesResult>("workspace_deadline_list", {
    atTime,
    mode: "full",
  });
  expect(deadlines.deadlines).toEqual(snapshot.upcomingDeadlines.items);
  expect(deadlines.total).toBe(5);
  const ids = deadlines.deadlines.map(
    (event: CalendarEvent) => event.payload.id,
  );
  expect(ids).toContain(edgeTodos[1].id);
  expect(ids).toContain(edgeTodos[2].id);
  for (const index of [0, 3, 4]) expect(ids).not.toContain(edgeTodos[index].id);
  const oneDay = await call<DeadlinesResult>("workspace_deadline_list", {
    atTime,
    dayLimit: 1,
    mode: "full",
  });
  expect(oneDay.total).toBe(4);
  expect(
    oneDay.deadlines.map((event: CalendarEvent) => event.payload.id),
  ).not.toContain(edgeTodos[2].id);
  const nineDays = await call<DeadlinesResult>("workspace_deadline_list", {
    atTime,
    dayLimit: 9,
    mode: "full",
  });
  expect(nineDays.total).toBe(7);
  expect(
    nineDays.deadlines.map((event: CalendarEvent) => event.payload.id),
  ).toEqual(expect.arrayContaining([edgeTodos[3].id, edgeTodos[4].id]));
  expect(
    (
      await call<SnapshotResult>("workspace_snapshot_get", {
        atTime,
        mode: "full",
      })
    ).upcomingDeadlines,
  ).toEqual(snapshot.upcomingDeadlines);
  await db.schedule.updateMany({
    where: { sectionId: fixture.section.id },
    data: { date: new Date("2026-05-06T00:00:00Z") },
  });
  const beyond = await call<SnapshotResult>("workspace_snapshot_get", {
    atTime,
    mode: "full",
  });
  expect(beyond.nextClass).toBeNull();
  expect(
    await call<NextClassResult>("workspace_schedule_next", {
      atTime,
      mode: "full",
    }),
  ).toMatchObject({ found: false, nextClass: null });
  return reader.checks(expectedState);
  });
});

test("overview.compact-operational-fields", async ({
  page,
  createCalendar,
  calendarProtocolRun,
  oauthOwner,
}) => {
  await calendarProtocolRun(async (io) => {
  const fixture = await createCalendar();
  const expectedState = await readCalendarState(oauthOwner.worker.database.owner);
  const reader = await prepareCalendarRead(page, oauthOwner, io, fixture, {
    name: "overview-contract",
    scopes: ["workspace.overview:read", "workspace.schedule:read"],
    tools: [["workspace_overview_get", "workspace.overview"]],
    usage: [["workspace.overview", 1]],
  });
  await reader.authorize();
  const { call } = reader;
  const result = await call<{
    overview: unknown;
    samples: {
      dueTodos: unknown[];
      dueHomeworks: unknown[];
      upcomingExams: unknown[];
    };
  }>("workspace_overview_get", {
    atTime: "2026-04-29T09:30:00+08:00",
    locale: "en-us",
  });
  expect(result.samples.dueTodos).toHaveLength(1);
  expect(result.samples.dueHomeworks).toHaveLength(1);
  expect(result.samples.upcomingExams).toHaveLength(1);
  expect(result.samples.dueTodos[0]).toMatchObject({
    id: fixture.todo.id,
    title: fixture.todo.title,
    priority: fixture.todo.priority,
  });
  expect(result.samples.dueHomeworks[0]).toMatchObject({
    id: fixture.homework.id,
    title: fixture.homework.title,
    section: { jwId: fixture.section.jwId },
  });
  expect(result.samples.upcomingExams[0]).toMatchObject({
    startTime: 1300,
    endTime: 1400,
    section: { jwId: fixture.section.jwId },
  });
  const inspect = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      expect(
        ["createdAt", "updatedAt", "deletedAt", "retiredAt", "lastEditedAt"],
        key,
      ).not.toContain(key);
      if (key === "section" && child && typeof child === "object") {
        expect(child).not.toHaveProperty("schedules");
        expect(child).not.toHaveProperty("exams");
        expect(child).not.toHaveProperty("homeworks");
      }
      inspect(child);
    }
  };
  inspect(result);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(
      "/workspace/overview?snapshotAt=2026-04-29T09%3A30%3A00%2B08%3A00",
    );
    const focus = page.getByTestId("workspace-overview-focus");
    await expect(focus.getByRole("link")).toBeVisible();
    await expect(focus).not.toContainText(
      /createdAt|updatedAt|Created at|Updated at|创建时间|更新时间/,
    );

    const summaries = page.getByTestId("workspace-overview-summaries");
    await expect(summaries).not.toContainText(
      /createdAt|updatedAt|Created at|Updated at|创建时间|更新时间/,
    );
  }
  return reader.checks(expectedState);
  });
});
