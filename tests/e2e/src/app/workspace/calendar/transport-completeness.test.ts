import { expect } from "@playwright/test";
import { test } from "../../../../utils/private-calendar-fixture";
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
  calendarProtocolRun,
  isolatedWorker,
  createCalendar,
  oauthOwner,
}) => {
  await calendarProtocolRun(async ({ request, mcp }) => {
    const db = isolatedWorker.database.owner;
    const fixture = await createCalendar();
    await page
      .context()
      .addCookies([
        (await isolatedWorker.createSession(fixture.users[0].id)).cookie,
      ]);
    const sessions = await db.session.findMany({
      where: { userId: fixture.users[0].id },
      select: { id: true },
    });
    expect(sessions).toHaveLength(1);
    const ownerSessionId = sessions[0].id;
    // Independent input IDs/times are the oracle; insertion order/returned rows
    // are not used to reconstruct the expected calendar.
    const items = Array.from({ length: 125 }, (_, index) => ({
      id: crypto.randomUUID(),
      userId: fixture.users[0].id,
      title: `Complete calendar ${index}`,
      dueAt: new Date(
        new Date(`${fixture.date}T00:00:00+08:00`).getTime() + index * 60_000,
      ),
    }));
    const extra = await db.$transaction(async (tx) => {
      await tx.todo.createMany({
        data: [
          ...items,
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
      const schedule = await tx.schedule.findFirstOrThrow({
        where: { sectionId: fixture.section.id },
      });
      const exam = await tx.exam.findFirstOrThrow({
        where: { sectionId: fixture.section.id },
      });
      return { items, schedule, exam };
    });
    const expected = [
      ...extra.items.map((item) => ({
        id: `todo-${item.id}`,
        type: "todo_due",
        at: item.dueAt.getTime(),
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
        headers: { origin: isolatedWorker.origin },
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
    const resource = `${isolatedWorker.origin}/api/mcp`;
    const token = await issueAccessToken(page, request, {
      owner: oauthOwner,
      scope,
      clientScopes: [scope],
      resource,
    });
    const client = await mcp(
      { name: "calendar-completeness", version: "1" },
      token.accessToken,
    );
    const callWindows: { start: number; end: number }[] = [];
    for (const mode of ["default", "full"]) {
      const start = Date.now();
      const result = await client.callTool({
        name: "workspace_calendar_event_list",
        arguments: {
          dateFrom: fixture.date,
          dateTo: fixture.activityDate,
          mode,
        },
      });
      callWindows.push({ start, end: Date.now() });
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
      .addCookies([
        (await isolatedWorker.createSession(fixture.users[1].id)).cookie,
      ]);
    const foreign = await page.request.get(
      `/api/workspace/calendar/events?dateFrom=${fixture.date}&dateTo=${fixture.activityDate}`,
    );
    expect(foreign.status(), await foreign.text()).toBe(200);
    expect(foreign.headers()["cache-control"]).toContain("private, no-store");
    const foreignBody = await foreign.json();
    expect(foreignBody.pagination.total).toBe(2);
    expect(
      foreignBody.data.map((item: { title: string }) => item.title).sort(),
    ).toEqual([fixture.young.name, "Foreign calendar task"].sort());
    // Runs only after browser, API, SDK and real server waitUntil work drain.
    return async () => {
      const consents = await db.oAuthConsent.findMany({
        select: {
          clientId: true,
          userId: true,
          grantId: true,
          scopes: true,
          resources: true,
          requestedUserInfoClaims: true,
        },
      });
      expect(consents).toEqual([{
        clientId: token.clientId,
        userId: fixture.users[0].id,
        grantId: expect.any(String),
        scopes: [scope],
        resources: [resource],
        requestedUserInfoClaims: [],
      }]);
      const { grantId } = consents[0];
      expect(grantId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(await db.auditLog.findMany({
        select: {
          action: true, outcome: true, channel: true,
          userId: true, subjectUserId: true, targetId: true, targetType: true,
          oauthClientId: true, oauthGrantId: true, sessionId: true, metadata: true,
        },
      })).toEqual([{
        action: "oauth_authorization_grant",
        outcome: "success",
        channel: "web",
        userId: fixture.users[0].id,
        subjectUserId: fixture.users[0].id,
        targetId: token.clientId,
        targetType: "oauth_client",
        oauthClientId: token.clientId,
        oauthGrantId: grantId,
        sessionId: ownerSessionId,
        metadata: {
          changedFields: ["resources", "scopes", "userinfoClaims"],
          resourceCount: 1,
          scopeCount: 1,
        },
      }]);
      expect(await db.user.findMany({
        orderBy: { id: "asc" },
        select: { id: true, calendarFeedToken: true },
      })).toEqual(fixture.users.map(({ id }) => ({
        id, calendarFeedToken: null,
      })).sort((left, right) => left.id.localeCompare(right.id)));
      const usage = await db.oAuthGrantUsageDaily.findMany({
        orderBy: { day: "asc" },
        select: {
          userId: true, clientId: true, grantId: true, grantKey: true,
          day: true, feature: true, channel: true,
          readCount: true, writeCount: true, errorCount: true, lastUsedAt: true,
        },
      });
      expect(usage.length).toBeGreaterThanOrEqual(1);
      expect(usage.length).toBeLessThanOrEqual(2);
      expect(usage.reduce((sum, row) => sum + row.readCount, 0)).toBe(2);
      for (const row of usage) {
        expect(row).toMatchObject({
          userId: fixture.users[0].id,
          clientId: token.clientId,
          grantId,
          grantKey: `grant:${grantId}`,
          feature: "workspace.calendar",
          channel: "mcp",
          writeCount: 0,
          // Successful large responses remain successes even when an observer
          // cannot inspect their entire payload. Do not bless truncation as error.
          errorCount: 0,
        });
      }
      // Independently enumerate only the day assignments allowed by these two
      // call intervals, including a call that crosses Shanghai midnight.
      const day = (time: number) => new Date(time + 8 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);
      expect(callWindows).toHaveLength(2);
      const days = callWindows.map(({ start, end }) => [...new Set([day(start), day(end)])]);
      const assignments = days[0].flatMap((first) => days[1].map((second) => [first, second]));
      expect(assignments.some((assignment) => {
        const expectedDays = [...new Set(assignment)].sort();
        return expectedDays.length === usage.length && expectedDays.every((expectedDay, index) => {
          const contributors = callWindows.filter((_, call) => assignment[call] === expectedDay);
          const row = usage[index];
          const last = row.lastUsedAt.getTime();
          return row.day.toISOString() === `${expectedDay}T00:00:00.000Z`
            && row.readCount === contributors.length
            && day(last) === expectedDay
            && last >= Math.max(...contributors.map(({ start }) => start))
            && last <= Math.max(...contributors.map(({ end }) => end));
        });
      })).toBe(true);
    };
  });
});
