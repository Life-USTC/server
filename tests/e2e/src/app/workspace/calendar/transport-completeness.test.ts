import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

type CalendarEvent = {
  id: string;
  type: string;
  at: string;
  endsAt: string | null;
};
type NativeEvent = {
  type: string;
  at: string;
  endsAt: string | null;
  payload: { id?: number | string; youngId?: string };
};

test("interface-hierarchy.representative-cross-surface-contract-6", async ({
  page,
  request,
}) => {
  const fixture = await createCalendarContractFixture();
  let clientId: string | undefined;
  let client: Client | undefined;
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.users[0].id)]);
    const extra = await withE2ePrisma(async (db) => {
      const items = [];
      for (let index = 0; index < 125; index++)
        items.push(
          await db.todo.create({
            data: {
              userId: fixture.users[0].id,
              title: `Complete calendar ${index}`,
              dueAt: new Date(
                new Date(`${fixture.date}T00:00:00+08:00`).getTime() +
                  index * 60_000,
              ),
            },
          }),
        );
      await db.todo.createMany({
        data: [
          {
            userId: fixture.users[1].id,
            title: "Foreign calendar task",
            dueAt: items[0].dueAt,
          },
          { userId: fixture.users[0].id, title: "Undated calendar task" },
          {
            userId: fixture.users[0].id,
            title: "Before window",
            dueAt: new Date(
              new Date(`${fixture.date}T00:00:00+08:00`).getTime() - 1,
            ),
          },
          {
            userId: fixture.users[0].id,
            title: "After window",
            dueAt: new Date(
              new Date(`${fixture.activityDate}T00:00:00+08:00`).getTime() +
                86400000,
            ),
          },
        ],
      });
      const schedule = await db.schedule.findFirstOrThrow({
        where: { sectionId: fixture.section.id },
      });
      const exam = await db.exam.findFirstOrThrow({
        where: { sectionId: fixture.section.id },
      });
      return { items, schedule, exam };
    });
    const expected = [
      ...extra.items.map((item) => ({
        id: `todo-${item.id}`,
        type: "todo_due",
        at: item.dueAt?.getTime(),
      })),
      {
        id: `schedule-${extra.schedule.id}-${fixture.date}T09:00:00+08:00`,
        type: "schedule",
        at: new Date(`${fixture.date}T09:00:00+08:00`).getTime(),
      },
      {
        id: `homework-${fixture.homework.id}`,
        type: "homework_due",
        at: new Date(`${fixture.date}T12:00:00+08:00`).getTime(),
      },
      {
        id: `exam-${extra.exam.id}`,
        type: "exam",
        at: new Date(`${fixture.date}T13:00:00+08:00`).getTime(),
      },
      {
        id: `todo-${fixture.todo.id}`,
        type: "todo_due",
        at: new Date(`${fixture.date}T15:00:00+08:00`).getTime(),
      },
      {
        id: `young-${fixture.young.youngId}`,
        type: "young_event",
        at: new Date(`${fixture.activityDate}T16:00:00+08:00`).getTime(),
      },
    ];
    expect(expected).toHaveLength(130);
    const project = (events: CalendarEvent[]) =>
      events.map((event) => ({
        id: event.id,
        type: event.type,
        at: new Date(event.at).getTime(),
      }));
    const query = `query Calendar($from: String!, $to: String!, $page: PageInput!) {
      workspace { calendarEvents(dateFrom: $from, dateTo: $to, page: $page) {
        items { id type at endsAt }
        pageInfo { page pageSize total totalPages }
      } }
    }`;
    const restEvents: CalendarEvent[] = [];
    const graphEvents: CalendarEvent[] = [];
    for (let pageNumber = 1; pageNumber <= 8; pageNumber++) {
      const params = new URLSearchParams({
        dateFrom: fixture.date,
        dateTo: fixture.activityDate,
        page: String(pageNumber),
        pageSize: "17",
      });
      const response = await page.request.get(
        `/api/workspace/calendar/events?${params}`,
      );
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["cache-control"]).toContain(
        "private, no-store",
      );
      const body = await response.json();
      expect(body.pagination).toMatchObject({
        page: pageNumber,
        pageSize: 17,
        total: 130,
        totalPages: 8,
      });
      expect(body.data).toHaveLength(pageNumber < 8 ? 17 : 11);
      restEvents.push(...body.data);
      const graphResponse = await page.request.post("/api/graphql", {
        headers: { origin: PLAYWRIGHT_BASE_URL },
        data: {
          query,
          variables: {
            from: fixture.date,
            to: fixture.activityDate,
            page: { page: pageNumber, pageSize: 17 },
          },
        },
      });
      expect(graphResponse.status()).toBe(200);
      const graph = await graphResponse.json();
      expect(graph.errors).toBeUndefined();
      expect(graph.data.workspace.calendarEvents.pageInfo).toEqual(
        body.pagination,
      );
      expect(graph.data.workspace.calendarEvents.items).toEqual(
        body.data.map(({ id, type, at, endsAt }: CalendarEvent) => ({
          id,
          type,
          at,
          endsAt,
        })),
      );
      graphEvents.push(...graph.data.workspace.calendarEvents.items);
    }
    expect(project(restEvents)).toEqual(expected);
    expect(project(graphEvents)).toEqual(expected);
    expect(new Set(restEvents.map((event) => event.id)).size).toBe(130);
    const scope = "workspace.calendar:read";
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    const token = await issueAccessToken(page, request, {
      scope,
      clientScopes: [scope],
      resource,
    });
    clientId = token.clientId;
    client = new Client({ name: "calendar-completeness", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(resource), {
        requestInit: {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        },
      }),
    );
    for (const mode of ["default", "full"]) {
      const result = await client.callTool({
        name: "workspace_calendar_event_list",
        arguments: {
          dateFrom: fixture.date,
          dateTo: fixture.activityDate,
          mode,
        },
      });
      expect(result.isError).not.toBe(true);
      const { events } = parseTextContent(result) as { events: NativeEvent[] };
      expect(events).toHaveLength(130);
      const native = events.map((event) => ({
        id:
          event.type === "young_event"
            ? `young-${event.payload.youngId}`
            : event.type === "schedule"
              ? `schedule-${event.payload.id}-${event.at}`
              : `${event.type === "homework_due" ? "homework" : event.type === "todo_due" ? "todo" : event.type}-${event.payload.id}`,
        type: event.type,
        at: new Date(event.at).getTime(),
      }));
      expect(native).toEqual(expected);
    }
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.users[1].id)]);
    const foreign = await page.request.get(
      `/api/workspace/calendar/events?dateFrom=${fixture.date}&dateTo=${fixture.activityDate}`,
    );
    const foreignBody = await foreign.json();
    expect(foreignBody.pagination.total).toBe(2);
    expect(
      foreignBody.data.map((item: { title: string }) => item.title).sort(),
    ).toEqual([fixture.young.name, "Foreign calendar task"].sort());
  } finally {
    await client?.close();
    if (clientId)
      await withE2ePrisma((db) =>
        db.oAuthClient.delete({ where: { clientId } }),
      );
    await fixture.cleanup();
  }
});
