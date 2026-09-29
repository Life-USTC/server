import { youngTransportTest as contractTest } from "../../../shared/young-transport-contract-fixture";

type CalendarRow = {
  id: string;
  type: string;
  at: string | null;
  youngId: string | null;
};

contractTest(
  "young-workspace.calendar-transport-pagination",
  async ({ state, expect, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const {
        routes: { getPersonalCalendarRoute },
      } = state;

      const { youngIds, clients, day, homeworkId, todoId, request, graphql } =
        state;

      const rest: CalendarRow[] = [];
      const gql: CalendarRow[] = [];
      for (const page of [1, 2, 3, 4]) {
        const response = await getPersonalCalendarRoute(
          await request(
            0,
            `/api/workspace/calendar?dateFrom=${day}&dateTo=${day}&page=${page}&pageSize=2`,
          ),
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.pagination).toMatchObject({
          page,
          pageSize: 2,
          total: 7,
          totalPages: 4,
        });
        expect(body.data).toHaveLength(page === 4 ? 1 : 2);
        rest.push(...body.data);
        const data = await graphql(
          0,
          `query($page: Int!) { workspace { calendarEvents(dateFrom: "${day}", dateTo: "${day}", page: {page: $page, pageSize: 2}) { items { id type at youngId } pageInfo { page pageSize total totalPages } } } }`,
          { page },
        );
        expect(data.workspace.calendarEvents.pageInfo).toMatchObject({
          page,
          pageSize: 2,
          total: 7,
          totalPages: 4,
        });
        gql.push(...data.workspace.calendarEvents.items);
      }
      const compact = (rows: CalendarRow[]) =>
        rows.map(({ id, type, at, youngId }) => ({ id, type, at, youngId }));
      expect(compact(rest)).toEqual(gql);
      expect(new Set(rest.map((row) => row.id)).size).toBe(7);
      expect(rest.map((row) => row.type)).toEqual([
        "schedule",
        "exam",
        "homework_due",
        "todo_due",
        "young_event",
        "young_event",
        "young_event",
      ]);
      expect(rest.flatMap((row) => (row.youngId ? [row.youngId] : []))).toEqual(
        youngIds.slice(0, 3),
      );
      const mcp = await clients[0].call<{
        events: {
          type: string;
          at: string;
          payload: { id?: string | number; youngId?: string };
        }[];
      }>("workspace_calendar_event_list", {
        dateFrom: day,
        dateTo: day,
        mode: "full",
      });
      expect(mcp.events).toHaveLength(7);
      expect(mcp.events.map((row) => ({ type: row.type, at: row.at }))).toEqual(
        rest.map((row) => ({ type: row.type, at: row.at })),
      );
      expect(
        mcp.events
          .filter((row) => row.type === "young_event")
          .map((row) => row.payload.youngId),
      ).toEqual(youngIds.slice(0, 3));
      expect(
        mcp.events.find((row) => row.type === "homework_due")?.payload.id,
      ).toBe(homeworkId);
      expect(
        mcp.events.find((row) => row.type === "todo_due")?.payload.id,
      ).toBe(todoId);
      const other = await getPersonalCalendarRoute(
        await request(
          1,
          `/api/workspace/calendar?dateFrom=${day}&dateTo=${day}`,
        ),
      );
      expect(
        (await other.json()).data.map((row: CalendarRow) => row.youngId),
      ).toEqual([youngIds[3]]);
    });
  },
);
