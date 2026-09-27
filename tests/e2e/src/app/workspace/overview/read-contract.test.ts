import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

let fixture: Awaited<ReturnType<typeof createCalendarContractFixture>>;
let clientId: string | undefined;
let client: Client;
test.beforeEach(async ({ page, request }) => {
  fixture = await createCalendarContractFixture();
  clientId = undefined;
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([await createSignedSessionCookie(fixture.users[0].id)]);
  const scope = "workspace.overview:read workspace.schedule:read";
  const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
  const token = await issueAccessToken(page, request, {
    scope,
    clientScopes: scope.split(" "),
    resource,
  });
  clientId = token.clientId;
  client = new Client({ name: "overview-contract", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(resource), {
      requestInit: {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      },
    }),
  );
});
test.afterEach(async () => {
  await client?.close();
  if (clientId)
    await withE2ePrisma((db) => db.oAuthClient.delete({ where: { clientId } }));
  await fixture?.cleanup();
});
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
async function call<Result>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Result> {
  const response = await client.callTool({ name, arguments: args });
  expect(response.isError).not.toBe(true);
  return parseTextContent(response) as Result;
}

test("overview.upcoming-exam-counts", async ({ page }) => {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const exams = await withE2ePrisma(async (db) => {
    await db.exam.deleteMany({ where: { sectionId: fixture.section.id } });
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
        await db.exam.create({
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
    headers: { origin: PLAYWRIGHT_BASE_URL },
    data: {
      query:
        "query($atTime: DateTime!) { workspace { overview(atTime: $atTime) { upcomingExams } } }",
      variables: { atTime: now.toISOString() },
    },
  });
  const graph = await gql.json();
  expect(graph.errors).toBeUndefined();
  expect(graph.data.workspace.overview.upcomingExams).toBe(4);
});

test("overview.focused-extracts-share-window", async () => {
  const atTime = "2026-04-29T08:00:00+08:00";
  const start = new Date(atTime).getTime();
  const day = 86400000;
  const edgeTodos = await withE2ePrisma(async (db) => {
    const created = [];
    for (const [label, offset] of [
      ["before", -1],
      ["start", 0],
      ["inside", 7 * day - 1],
      ["end", 7 * day],
      ["outside", 8 * day],
    ] as const) {
      created.push(
        await db.todo.create({
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
  await withE2ePrisma((db) =>
    db.schedule.updateMany({
      where: { sectionId: fixture.section.id },
      data: { date: new Date("2026-05-06T00:00:00Z") },
    }),
  );
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
});
