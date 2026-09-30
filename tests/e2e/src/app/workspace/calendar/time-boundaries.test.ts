import { prepareCalendarRead, readCalendarState } from "../../../../utils/calendar-read-observation";
import { expect } from "@playwright/test";
import { test } from "../../../../utils/private-calendar-fixture";
import { parseTextContent } from "../../api/mcp/helpers";

type Event = { type: string; at: string; endsAt: string | null };
const instants = (events: Event[]) =>
  events.map(({ type, at, endsAt }) => {
    expect(at).toMatch(/(?:Z|[+-]\d{2}:\d{2})$/);
    if (endsAt) expect(endsAt).toMatch(/(?:Z|[+-]\d{2}:\d{2})$/);
    return {
      type,
      at: Date.parse(at),
      endsAt: endsAt ? Date.parse(endsAt) : null,
    };
  });

test("interface-hierarchy.semantic-parity-4", async ({
  page,
  calendarProtocolRun,
  isolatedWorker,
  createCalendar,
  oauthOwner,
}) => {
  await calendarProtocolRun(async (io) => {
    const db = isolatedWorker.database.owner;
    const fixture = await createCalendar();
    const first = Date.parse(`${fixture.date}T00:00:00+08:00`);
    const last = Date.parse(`${fixture.activityDate}T23:59:59.999+08:00`);
    await db.todo.createMany({
      data: [first - 1, first, last, last + 1].map((dueAt) => ({
        userId: fixture.users[0].id,
        title: `Boundary ${dueAt}`,
        dueAt: new Date(dueAt),
      })),
    });
    const expectedState = await readCalendarState(db);
    const client = await prepareCalendarRead(page, oauthOwner, io, fixture, {
      name: "calendar-time-boundaries",
      scopes: ["workspace.calendar:read"],
      tools: Array.from({ length: 8 }, () => ["workspace_calendar_event_list", "workspace.calendar"] as const),
      usage: [["workspace.calendar", 8]],
    });
    await client.authorize();
    const expected = [
      { type: "todo_due", at: first, endsAt: null },
      {
        type: "schedule",
        at: Date.parse(`${fixture.date}T09:00:00+08:00`),
        endsAt: Date.parse(`${fixture.date}T10:00:00+08:00`),
      },
      {
        type: "homework_due",
        at: Date.parse(`${fixture.date}T12:00:00+08:00`),
        endsAt: null,
      },
      {
        type: "exam",
        at: Date.parse(`${fixture.date}T13:00:00+08:00`),
        endsAt: Date.parse(`${fixture.date}T14:00:00+08:00`),
      },
      {
        type: "todo_due",
        at: Date.parse(`${fixture.date}T15:00:00+08:00`),
        endsAt: null,
      },
      {
        type: "young_event",
        at: Date.parse(`${fixture.activityDate}T16:00:00+08:00`),
        endsAt: Date.parse(`${fixture.activityDate}T17:00:00+08:00`),
      },
      { type: "todo_due", at: last, endsAt: null },
    ];
    for (const [dateFrom, dateTo] of [
      [fixture.date, fixture.activityDate],
      [
        `${fixture.date}T00:00:00+08:00`,
        `${fixture.activityDate}T23:59:59.999+08:00`,
      ],
      [new Date(first).toISOString(), new Date(last).toISOString()],
      [`${fixture.date}T00:00:00`, `${fixture.activityDate}T23:59:59.999`],
    ]) {
      const response = await page.request.get(
        `/api/workspace/calendar/events?${new URLSearchParams({ dateFrom, dateTo })}`,
      );
      expect(response.status(), await response.text()).toBe(200);
      const rest = await response.json();
      expect(rest.pagination.total).toBe(7);
      expect(instants(rest.data)).toEqual(expected);
      const graphResponse = await page.request.post("/api/graphql", {
        headers: { origin: isolatedWorker.origin },
        data: {
          query: `query($from: String!, $to: String!) { workspace { calendarEvents(dateFrom: $from, dateTo: $to) { items { type at endsAt } pageInfo { total } } } }`,
          variables: { from: dateFrom, to: dateTo },
        },
      });
      expect(graphResponse.status()).toBe(200);
      const graph = await graphResponse.json();
      expect(graph.errors).toBeUndefined();
      expect(graph.data.workspace.calendarEvents.pageInfo.total).toBe(7);
      expect(instants(graph.data.workspace.calendarEvents.items)).toEqual(
        expected,
      );
      for (const mode of ["default", "full"]) {
        const result = await client.callTool({
          name: "workspace_calendar_event_list",
          arguments: { dateFrom, dateTo, mode },
        });
        expect(result.isError, JSON.stringify(result)).not.toBe(true);
        expect(
          instants((parseTextContent(result) as { events: Event[] }).events),
        ).toEqual(expected);
      }
    }
    return client.checks(expectedState);
  });
});
