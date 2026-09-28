import { afterEach, expect, it, vi } from "vitest";
import * as queryParsing from "@/lib/api/route-query-parsing";
import { getSchedulesRoute } from "@/lib/api/routes/academic-schedule-routes";
import { getBusNextDeparturesRoute } from "@/lib/api/routes/bus";
import { getHomeworksRoute } from "@/lib/api/routes/homework-list-read-route";
import { getMySubscribedSchedulesRoute } from "@/lib/api/routes/subscribed-schedule-routes";
import { getTodosRoute } from "@/lib/api/routes/todos";
import { getMyCompactOverviewRoute } from "@/lib/api/routes/workspace-overview-route";
import {
  busNextDeparturesQuerySchema,
  compactOverviewQuerySchema,
  homeworksQuerySchema,
  schedulesQuerySchema,
  subscribedSchedulesQuerySchema,
  todosQuerySchema,
} from "@/lib/api/schemas/request-schemas";

const mocks = vi.hoisted(() => ({
  bus: vi.fn().mockResolvedValue(null),
  schedules: vi.fn().mockResolvedValue({
    data: [],
    pagination: { page: 2, pageSize: 3, total: 0, totalPages: 0 },
  }),
  subscribed: vi.fn().mockResolvedValue([]),
  todos: vi.fn().mockImplementation(async () => Response.json({ data: [] })),
  overview: vi.fn().mockResolvedValue({}),
  homeworks: vi.fn().mockResolvedValue({ data: [], viewer: null }),
}));
vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "query-owner" }),
  resolveSessionUserId: vi.fn().mockResolvedValue("query-owner"),
}));
vi.mock("@/features/bus/server/bus-service", () => ({
  getNextBusDepartures: mocks.bus,
}));
vi.mock("@/features/catalog/server/schedule-read-model", () => ({
  listPublicSchedules: mocks.schedules,
}));
vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listSubscribedSchedules: mocks.subscribed,
  toSubscribedScheduleEntryDto: vi.fn(),
}));
vi.mock("@/features/workspace/server/compact-overview-read-model", () => ({
  getCompactOverview: mocks.overview,
}));
vi.mock("@/features/homeworks/server/homework-list-read-model", () => ({
  listSectionHomeworkPageWithViewer: mocks.homeworks,
}));
vi.mock("@/lib/api/routes/homework-route-helpers", () => ({
  resolveHomeworkRouteSectionIds: vi.fn().mockResolvedValue([1, 2]),
}));
vi.mock("@/lib/api/routes/todo-actions", () => ({
  listTodosAction: mocks.todos,
  createTodoAction: vi.fn(),
  deleteTodoAction: vi.fn(),
  updateTodoAction: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

it("openapi.schema-query-parsing", async () => {
  const cases = [
    {
      handler: getBusNextDeparturesRoute,
      schema: busNextDeparturesQuerySchema,
      service: mocks.bus,
      query:
        "originCampusId=1&destinationCampusId=2&includeDeparted=false&limit=5&atTime=2026-03-01T08%3A30%3A00%2B08%3A00",
      expected: [
        {
          originCampusId: 1,
          destinationCampusId: 2,
          includeDeparted: false,
          limit: 5,
          atTime: "2026-03-01T00:30:00.000Z",
        },
      ],
      invalid: [
        "includeDeparted=yes",
        "limit=0",
        "limit=1.5",
        "atTime=not-a-date",
        "originCampusId=-1",
      ],
      parser: "parseRouteSearchParams" as const,
    },
    {
      handler: getSchedulesRoute,
      schema: schedulesQuerySchema,
      service: mocks.schedules,
      query: "sectionJwId=123&weekday=2&dateFrom=2026-03-01&page=2&pageSize=3",
      expected: [
        {
          filters: {
            sectionJwId: 123,
            weekday: 2,
            dateFrom: new Date("2026-03-01T00:00:00Z"),
          },
          page: 2,
          pageSize: 3,
        },
      ],
      invalid: [
        "weekday=0",
        "weekday=8",
        "weekday=1.5",
        "dateFrom=",
        "dateFrom=not-a-date",
      ],
      parser: "parseRouteQuery" as const,
    },
    {
      handler: getMySubscribedSchedulesRoute,
      schema: subscribedSchedulesQuerySchema,
      service: mocks.subscribed,
      query: "weekday=7&dateFrom=2026-03-01&limit=150",
      expected: [
        "query-owner",
        { weekday: 7, dateFrom: new Date("2026-03-01T00:00:00Z"), limit: 150 },
      ],
      invalid: ["weekday=8", "dateFrom=not-a-date", "limit=0"],
      parser: "parseRouteSearchParams" as const,
    },
    {
      handler: getTodosRoute,
      schema: todosQuerySchema,
      service: mocks.todos,
      query: "completed=true&dueBefore=2026-03-01&limit=20",
      expected: [
        "query-owner",
        { completed: true, dueBefore: new Date("2026-03-01T00:00:00Z") },
        20,
      ],
      invalid: ["completed=0", "dueBefore=not-a-date", "limit=0", "limit=1.5"],
      parser: "parseRouteSearchParams" as const,
    },
    {
      handler: getMyCompactOverviewRoute,
      schema: compactOverviewQuerySchema,
      service: mocks.overview,
      query: "atTime=2026-03-01&homeworkWindowDays=7&limit=3",
      expected: [
        "query-owner",
        {
          atTime: new Date("2026-02-28T16:00:00Z"),
          homeworkWindowDays: 7,
          limit: 3,
        },
      ],
      invalid: ["atTime=not-a-date", "homeworkWindowDays=-1", "limit=0"],
      parser: "parseRouteSearchParams" as const,
    },
    {
      handler: getHomeworksRoute,
      schema: homeworksQuerySchema,
      service: mocks.homeworks,
      query: "includeDeleted=true&sectionIds=1,2&page=2&pageSize=3",
      expected: [
        {
          includeDeleted: true,
          sectionIds: [1, 2],
          pagination: { page: 2, pageSize: 3 },
        },
      ],
      invalid: ["includeDeleted=yes", "sectionIds=1,invalid", "pageSize=51"],
      parser: "parseRouteQuery" as const,
    },
  ];
  for (const scenario of cases) {
    const parse = vi.spyOn(scenario.schema, "safeParse");
    const boundary = vi.spyOn(queryParsing, scenario.parser);
    scenario.service.mockClear();
    const response = await scenario.handler(
      new Request(`https://life.example/api/query?${scenario.query}`),
    );
    expect(response.status).toBe(scenario.service === mocks.bus ? 404 : 200);
    expect(parse).toHaveBeenCalledOnce();
    expect(scenario.service).toHaveBeenCalledOnce();
    expect(scenario.service.mock.calls[0]).toMatchObject(scenario.expected);
    for (const invalid of scenario.invalid) {
      parse.mockClear();
      boundary.mockClear();
      scenario.service.mockClear();
      const query = new URLSearchParams(scenario.query);
      for (const [key, value] of new URLSearchParams(invalid))
        query.set(key, value);
      const rejected = await scenario.handler(
        new Request(`https://life.example/api/query?${query}`),
      );
      expect(rejected.status, `${scenario.handler.name}: ${invalid}`).toBe(400);
      expect(parse).toHaveBeenCalledOnce();
      expect(boundary).toHaveBeenCalledOnce();
      expect(rejected).toBe(boundary.mock.results[0].value);
      expect(scenario.service).not.toHaveBeenCalled();
      await rejected.text();
    }
    parse.mockRestore();
    boundary.mockRestore();
  }
});
