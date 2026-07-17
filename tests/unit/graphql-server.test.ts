import type { RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";

const courseService = vi.hoisted(() => ({
  listCourseSummaries: vi.fn(),
}));
const busService = vi.hoisted(() => ({
  getBusRouteTimetable: vi.fn(),
  listBusRoutes: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-summary-read-model", () => ({
  listCourseSummaries: courseService.listCourseSummaries,
}));
vi.mock("@/features/bus/server/bus-catalog", () => busService);

import { createGraphqlRequestHandler } from "@/lib/graphql/server";

const developmentHandler = createGraphqlRequestHandler(false);
const productionHandler = createGraphqlRequestHandler(true);

function requestEvent(body: unknown): RequestEvent {
  return {
    request: new Request("https://example.test/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "graphql-unit-test",
    },
  } as unknown as RequestEvent;
}

async function execute(
  body: unknown,
  production = false,
): Promise<{ response: Response; payload: Record<string, unknown> }> {
  const response = await (production ? productionHandler : developmentHandler)(
    requestEvent(body),
  );
  return {
    response,
    payload: (await response.json()) as Record<string, unknown>,
  };
}

function errorMessages(payload: Record<string, unknown>) {
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  return errors.flatMap((error) =>
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? [error.message]
      : [],
  );
}

describe("GraphQL HTTP boundary", () => {
  beforeEach(() => {
    courseService.listCourseSummaries.mockReset();
    busService.getBusRouteTimetable.mockReset();
    busService.listBusRoutes.mockReset();
    courseService.listCourseSummaries.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
      },
    });
    busService.getBusRouteTimetable.mockResolvedValue(null);
    busService.listBusRoutes.mockResolvedValue({ routes: [], campuses: [] });
  });

  it("serves public queries without a session and prevents response caching", async () => {
    const { response, payload } = await execute({
      query: "{ courses { items { jwId } pageInfo { total } } }",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual({
      data: { courses: { items: [], pageInfo: { total: 0 } } },
    });
  });

  it("masks unexpected resolver details", async () => {
    courseService.listCourseSummaries.mockRejectedValueOnce(
      new Error("database-password-should-never-leak"),
    );

    const { payload } = await execute({
      query: "{ courses { items { jwId } } }",
    });

    expect(errorMessages(payload).join(" ")).not.toContain(
      "database-password-should-never-leak",
    );
    expect(errorMessages(payload)).toContain("Unexpected error.");
  });

  it.each([
    [
      "page",
      `{ courses(page: { page: ${GRAPHQL_LIMITS.page + 1} }) { pageInfo { total } } }`,
    ],
    ["root ID", "{ course(jwId: 0) { jwId } }"],
    [
      "identifier list",
      `{ sections(filter: { ids: [${Array.from(
        { length: GRAPHQL_LIMITS.idList + 1 },
        (_, index) => index + 1,
      ).join(",")}] }) { pageInfo { total } } }`,
    ],
    [
      "search text",
      `{ courses(filter: { search: "${"x".repeat(
        GRAPHQL_LIMITS.searchChars + 1,
      )}" }) { pageInfo { total } } }`,
    ],
    [
      "bus datetime",
      '{ busTimetable(routeId: 1, now: "2026-04-29T08:00:00") { route { id } } }',
    ],
    [
      "bus version",
      '{ busTimetable(routeId: 1, versionKey: "../unsafe") { route { id } } }',
    ],
  ])("rejects invalid %s before service execution", async (_name, query) => {
    const { payload } = await execute({ query });

    expect(errorMessages(payload)).not.toHaveLength(0);
  });

  it("rejects oversized request bodies", async () => {
    const { response, payload } = await execute(
      "x".repeat(GRAPHQL_LIMITS.bodyBytes + 1),
    );

    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      errors: [
        {
          extensions: { code: "REQUEST_TOO_LARGE" },
        },
      ],
    });
  });

  it("rejects batched operations", async () => {
    const { response, payload } = await execute([
      { query: "{ currentSemester { jwId } }" },
      { query: "{ currentSemester { jwId } }" },
    ]);

    expect(response.ok).toBe(false);
    expect(errorMessages(payload)).not.toHaveLength(0);
  });

  it.each([
    [
      "inline literal",
      {
        query:
          '{ busTimetable(routeId: 1, now: "2026-04-29T08:00:00+08:00") { route { id } } }',
      },
    ],
    [
      "variable",
      {
        query:
          "query Timetable($now: DateTime!) { busTimetable(routeId: 1, now: $now) { route { id } } }",
        variables: { now: "2026-04-29T08:00:00+08:00" },
      },
    ],
  ])("coerces a strict zoned DateTime from an %s", async (_name, body) => {
    const { payload } = await execute(body);

    expect(payload).toEqual({ data: { busTimetable: null } });
    expect(busService.getBusRouteTimetable).toHaveBeenCalledWith(
      expect.objectContaining({ now: "2026-04-29T08:00:00+08:00" }),
    );
  });

  it.each([
    [
      "inline literal",
      {
        query:
          '{ busTimetable(routeId: 1, now: "2026-04-31T08:00:00+08:00") { route { id } } }',
      },
    ],
    [
      "variable",
      {
        query:
          "query Timetable($now: DateTime!) { busTimetable(routeId: 1, now: $now) { route { id } } }",
        variables: { now: "2026-04-29T08:00:00" },
      },
    ],
  ])("rejects an invalid zoned DateTime from an %s", async (_name, body) => {
    const { payload } = await execute(body);

    expect(errorMessages(payload)).not.toHaveLength(0);
    expect(busService.getBusRouteTimetable).not.toHaveBeenCalled();
  });

  it("disables production introspection", async () => {
    const { payload } = await execute(
      { query: "{ __schema { queryType { name } } }" },
      true,
    );

    expect(errorMessages(payload)).not.toHaveLength(0);
    expect(payload).not.toHaveProperty("data.__schema");
  });

  it.each([
    [
      "top-level fields",
      `{ ${Array.from(
        { length: GRAPHQL_LIMITS.topLevelFields + 1 },
        (_, index) => `q${index}: currentSemester { jwId }`,
      ).join(" ")} }`,
    ],
    [
      "aliases",
      `{ courses { ${Array.from(
        { length: GRAPHQL_LIMITS.aliases + 1 },
        (_, index) => `a${index}: items { jwId }`,
      ).join(" ")} } }`,
    ],
    [
      "directives",
      `{ courses { items { ${Array.from(
        { length: GRAPHQL_LIMITS.directives + 1 },
        (_, index) => `f${index}: code @skip(if: false)`,
      ).join(" ")} } } }`,
    ],
    [
      "tokens",
      `{ courses { items { ${"code ".repeat(GRAPHQL_LIMITS.tokens + 1)} } } }`,
    ],
  ])("enforces the %s budget", async (_name, query) => {
    const { payload } = await execute({ query });

    expect(errorMessages(payload)).not.toHaveLength(0);
  });
});
