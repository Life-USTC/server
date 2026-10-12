import { youngTransportTest as contractTest } from "../../../shared/young-transport-contract-fixture";

type CalendarRow = {
  id: string;
  type: string;
  at: string | null;
  youngId: string | null;
};

for (const method of ["REST", "GraphQL", "MCP"] as const) {
  contractTest(
    `young-workspace.calendar-transport-pagination (${method})`,
    { tags: [`@Calendar/${method}`] },
    async ({ state, expect, protocolRuntime }) => {
      await protocolRuntime.run(async () => {
        const {
          db,
          routes: { getPersonalCalendarRoute },
          youngIds,
          clients,
          day,
          homeworkId,
          todoId,
          request,
          graphql,
        } = state;
        const schedule = await db.schedule.findFirstOrThrow();
        const exam = await db.exam.findFirstOrThrow();
        const at = (hour: number) =>
          `${day}T${String(hour).padStart(2, "0")}:00:00+08:00`;
        const expected: CalendarRow[] = [
          {
            id: `schedule-${schedule.id}-${at(8)}`,
            type: "schedule",
            at: at(8),
            youngId: null,
          },
          { id: `exam-${exam.id}`, type: "exam", at: at(10), youngId: null },
          {
            id: `homework-${homeworkId}`,
            type: "homework_due",
            at: at(12),
            youngId: null,
          },
          { id: `todo-${todoId}`, type: "todo_due", at: at(13), youngId: null },
          ...youngIds.slice(0, 3).map((youngId, index) => ({
            id: `young-${youngId}`,
            type: "young_event",
            at: at(15 + index),
            youngId,
          })),
        ];
        if (method !== "MCP") {
          const rows: CalendarRow[] = [];
          for (const page of [1, 2, 3, 4]) {
            if (method === "REST") {
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
              rows.push(...body.data);
            } else {
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
              rows.push(...data.workspace.calendarEvents.items);
            }
          }
          expect(
            rows.map(({ id, type, at, youngId }) => ({
              id,
              type,
              at,
              youngId,
            })),
          ).toEqual(expected);
          expect(new Set(rows.map((row) => row.id)).size).toBe(7);
          expect(rows.map((row) => row.type)).toEqual(
            expected.map((row) => row.type),
          );
          expect(
            rows.flatMap((row) => (row.youngId ? [row.youngId] : [])),
          ).toEqual(youngIds.slice(0, 3));
        } else {
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
          expect(mcp.events.map(({ type, at }) => ({ type, at }))).toEqual(
            expected.map(({ type, at }) => ({ type, at })),
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
        }
        if (method === "REST") {
          const other = await getPersonalCalendarRoute(
            await request(
              1,
              `/api/workspace/calendar?dateFrom=${day}&dateTo=${day}`,
            ),
          );
          expect(
            (await other.json()).data.map((row: CalendarRow) => row.youngId),
          ).toEqual([youngIds[3]]);
        }
      });
    },
  );
}
