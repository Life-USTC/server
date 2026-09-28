import type { RequestEvent } from "@sveltejs/kit";
import { GraphQLError } from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import { createDeferred } from "../../../shared/deferred";

const courseService = vi.hoisted(() => ({
  listCourseSummaries: vi.fn(),
}));
const busService = vi.hoisted(() => ({
  getBusRouteTimetable: vi.fn(),
  listBusRoutes: vi.fn(),
}));
const authCore = vi.hoisted(() => ({
  getSessionFromHeaders: vi.fn(),
}));
const todoService = vi.hoisted(() => ({
  createTodo: vi.fn(),
  deleteOwnedTodo: vi.fn(),
  updateOwnedTodo: vi.fn(),
}));
const descriptionService = vi.hoisted(() => ({
  upsertDescriptionContent: vi.fn(),
}));
const descriptionTargets = vi.hoisted(() => ({
  resolveDescriptionTargetReference: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-summary-read-model", () => ({
  listCourseSummaries: courseService.listCourseSummaries,
}));
vi.mock("@/features/bus/server/bus-catalog", () => busService);
vi.mock("@/features/todos/server/todo-service", () => todoService);
vi.mock(
  "@/features/descriptions/server/description-upsert",
  () => descriptionService,
);
vi.mock(
  "@/features/descriptions/server/description-targets",
  () => descriptionTargets,
);
vi.mock("@/lib/auth/core", () => authCore);

import { createGraphqlRequestHandler } from "@/lib/graphql/server";

const developmentHandler = createGraphqlRequestHandler(false);
const productionHandler = createGraphqlRequestHandler(true);

afterEach(() => setCloudflareRuntimeEnv(undefined));

function requestEventFromRequest(request: Request): RequestEvent {
  return {
    request,
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "graphql-unit-test",
    },
  } as unknown as RequestEvent;
}

function sessionRequestEvent(
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return requestEventFromRequest(
    new Request("http://localhost:3000/api/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=session-token",
        origin: "http://localhost:3000",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    }),
  );
}

function requestEvent(body: unknown): RequestEvent {
  return requestEventFromRequest(
    new Request("https://example.test/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
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
    authCore.getSessionFromHeaders.mockReset();
    todoService.createTodo.mockReset();
    todoService.deleteOwnedTodo.mockReset();
    todoService.updateOwnedTodo.mockReset();
    descriptionService.upsertDescriptionContent.mockReset();
    descriptionTargets.resolveDescriptionTargetReference.mockReset();
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
    authCore.getSessionFromHeaders.mockResolvedValue(null);
    todoService.createTodo.mockResolvedValue({ id: "todo-created" });
    descriptionTargets.resolveDescriptionTargetReference.mockResolvedValue({
      ok: true,
      target: {},
      targetId: 101,
      targetType: "section",
    });
    descriptionService.upsertDescriptionContent.mockResolvedValue({
      id: "description-created",
      ok: true,
      updated: true,
    });
  });

  it("graphql.response-no-store", async () => {
    const { response, payload } = await execute({
      query: "{ catalog { courses { items { jwId } pageInfo { total } } } }",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual({
      data: { catalog: { courses: { items: [], pageInfo: { total: 0 } } } },
    });
  });

  it("graphql.production-discovery", async () => {
    const ideRequest = () =>
      requestEventFromRequest(
        new Request("https://example.test/api/graphql", {
          headers: { accept: "text/html" },
        }),
      );
    const developmentResponse = await developmentHandler(ideRequest());
    const productionResponse = await productionHandler(ideRequest());

    expect(developmentResponse.headers.get("content-type")).toContain(
      "text/html",
    );
    expect(await developmentResponse.text()).toContain("GraphiQL");
    expect(productionResponse.status).toBe(406);
    expect(productionResponse.headers.get("content-type") ?? "").not.toContain(
      "text/html",
    );
    expect(await productionResponse.text()).not.toContain("GraphiQL");

    const query = encodeURIComponent(
      "{ catalog { courses { items { jwId } pageInfo { total } } } }",
    );
    const queryResponse = await productionHandler(
      requestEventFromRequest(
        new Request(`https://example.test/api/graphql?query=${query}`),
      ),
    );
    expect(await queryResponse.json()).toEqual({
      data: { catalog: { courses: { items: [], pageInfo: { total: 0 } } } },
    });
    expect(courseService.listCourseSummaries).toHaveBeenCalledTimes(1);
  });

  it("rejects mutation operations over GET and serves CORS preflight", async () => {
    const mutation = encodeURIComponent(
      'mutation Forbidden { todoDelete(id: "test") { success } }',
    );
    const mutationResponse = await productionHandler(
      requestEventFromRequest(
        new Request(`https://example.test/api/graphql?query=${mutation}`),
      ),
    );
    const mutationPayload = (await mutationResponse.json()) as Record<
      string,
      unknown
    >;
    expect(errorMessages(mutationPayload)).not.toHaveLength(0);
    expect(courseService.listCourseSummaries).not.toHaveBeenCalled();

    const preflightResponse = await productionHandler(
      requestEventFromRequest(
        new Request("https://example.test/api/graphql", {
          method: "OPTIONS",
          headers: {
            origin: "https://client.example",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
          },
        }),
      ),
    );
    expect(preflightResponse.status).toBe(204);
    expect(preflightResponse.headers.get("cache-control")).toBe("no-store");
    expect(preflightResponse.headers.get("access-control-allow-origin")).toBe(
      "https://client.example",
    );
    expect(preflightResponse.headers.get("access-control-allow-methods")).toBe(
      "POST",
    );
    expect(preflightResponse.headers.get("access-control-allow-headers")).toBe(
      "content-type",
    );
  });

  it("executes a session-authenticated POST mutation and prevents response caching", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    const response = await developmentHandler(
      requestEventFromRequest(
        new Request("http://localhost:3000/api/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session_token=session-token",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            query:
              'mutation { todoCreate(input: { title: "  Session todo  " }) { id } }',
          }),
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      data: { todoCreate: { id: "todo-created" } },
    });
    expect(todoService.createTodo).toHaveBeenCalledWith({
      userId: "session-user",
      title: "Session todo",
      content: undefined,
      priority: "medium",
      dueAt: undefined,
    });
  });

  it("preserves omitted versus explicit null todo update fields", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    todoService.updateOwnedTodo.mockResolvedValue({
      ok: true,
      todo: { id: "todo-updated" },
    });
    const response = await developmentHandler(
      requestEventFromRequest(
        new Request("http://localhost:3000/api/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session_token=session-token",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            query:
              'mutation { todoUpdate(id: "todo-updated", input: { content: null }) { id } }',
          }),
        }),
      ),
    );

    expect(await response.json()).toEqual({
      data: { todoUpdate: { id: "todo-updated" } },
    });
    expect(todoService.updateOwnedTodo).toHaveBeenCalledWith({
      id: "todo-updated",
      userId: "session-user",
      data: {
        completed: undefined,
        content: null,
        dueAt: undefined,
        hasContent: true,
        hasDueAt: false,
        priority: undefined,
        title: undefined,
      },
    });
  });

  it("reuses the description service with session identity and GraphQL audit metadata", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    const response = await developmentHandler(
      sessionRequestEvent(
        {
          query: /* GraphQL */ `
            mutation UpsertDescription($input: UpsertDescriptionInput!) {
              descriptionSet(input: $input) {
                id
                updated
              }
            }
          `,
          variables: {
            input: {
              content: "  GraphQL description  ",
              sectionJwId: 12345,
              targetType: "SECTION",
            },
          },
        },
        {
          "cf-connecting-ip": "192.0.2.40",
          "cf-ray": "request-1",
          "user-agent": "graphql-unit-agent",
        },
      ),
    );

    expect(await response.json()).toEqual({
      data: {
        descriptionSet: {
          id: "description-created",
          updated: true,
        },
      },
    });
    expect(
      descriptionTargets.resolveDescriptionTargetReference,
    ).toHaveBeenCalledWith({
      courseJwId: undefined,
      homeworkId: undefined,
      rawTargetId: undefined,
      sectionJwId: 12345,
      targetType: "section",
      teacherId: undefined,
      verifyExistence: true,
    });
    expect(descriptionService.upsertDescriptionContent).toHaveBeenCalledWith({
      auditMetadata: {
        channel: "graphql",
        ipAddress: "192.0.2.40",
        requestId: expect.any(String),
        source: "graphql",
        subjectUserId: "session-user",
        userAgent: "graphql-unit-agent",
        userId: "session-user",
      },
      content: "GraphQL description",
      targetId: 101,
      targetType: "section",
      userId: "session-user",
    });
  });

  it("preserves description input, target, and suspension errors", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    const request = (
      input: Record<string, unknown> = {
        content: "content",
        homeworkId: "missing-homework",
        targetType: "HOMEWORK",
      },
    ) =>
      sessionRequestEvent({
        query: /* GraphQL */ `
          mutation UpsertDescription($input: UpsertDescriptionInput!) {
            descriptionSet(input: $input) {
              id
            }
          }
        `,
        variables: { input },
      });

    descriptionTargets.resolveDescriptionTargetReference.mockResolvedValueOnce({
      error: "target_not_found",
      ok: false,
      targetId: "missing-homework",
      targetType: "homework",
    });
    const missingResponse = await productionHandler(request());
    expect(await missingResponse.json()).toMatchObject({
      data: null,
      errors: [
        {
          extensions: { code: "NOT_FOUND" },
          message: "Description target not found.",
        },
      ],
    });
    expect(descriptionService.upsertDescriptionContent).not.toHaveBeenCalled();

    descriptionService.upsertDescriptionContent.mockResolvedValueOnce({
      error: "suspended",
      ok: false,
      reason: "suspended for test",
    });
    const suspendedResponse = await productionHandler(request());
    expect(await suspendedResponse.json()).toMatchObject({
      data: null,
      errors: [
        {
          extensions: { code: "FORBIDDEN" },
          message: "Description writes are suspended.",
        },
      ],
    });

    const oversizedResponse = await productionHandler(
      request({
        content: ` ${"x".repeat(4000)} `,
        homeworkId: "missing-homework",
        targetType: "HOMEWORK",
      }),
    );
    expect(await oversizedResponse.json()).toMatchObject({
      data: null,
      errors: [
        {
          extensions: { code: "BAD_USER_INPUT" },
          message: "content must not exceed 4000 characters.",
        },
      ],
    });
    expect(descriptionService.upsertDescriptionContent).toHaveBeenCalledTimes(
      1,
    );
    expect(
      descriptionTargets.resolveDescriptionTargetReference,
    ).toHaveBeenCalledTimes(2);
  });

  it("preserves safe mutation errors in production", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    const response = await productionHandler(
      requestEventFromRequest(
        new Request("http://localhost:3000/api/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session_token=session-token",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            query: 'mutation { todoCreate(input: { title: "   " }) { id } }',
          }),
        }),
      ),
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toMatchObject({
      data: null,
      errors: [
        {
          message: "title must contain 1-200 characters.",
          extensions: { code: "BAD_USER_INPUT" },
        },
      ],
    });
    expect(todoService.createTodo).not.toHaveBeenCalled();
  });

  it("preserves mutation not-found errors in production", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    todoService.deleteOwnedTodo.mockResolvedValue({
      ok: false,
      error: "not_found",
    });
    const response = await productionHandler(
      requestEventFromRequest(
        new Request("http://localhost:3000/api/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session_token=session-token",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            query: 'mutation { todoDelete(id: "missing") { success } }',
          }),
        }),
      ),
    );

    expect(await response.json()).toMatchObject({
      data: null,
      errors: [
        {
          message: "Todo not found.",
          extensions: { code: "NOT_FOUND" },
        },
      ],
    });
  });

  it("preserves rate-limit errors in production", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    setCloudflareRuntimeEnv({
      USER_WRITE_RATE_LIMITER: {
        limit: vi.fn().mockResolvedValue({ success: false }),
      },
    });
    const response = await productionHandler(
      requestEventFromRequest(
        new Request("http://localhost:3000/api/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session_token=session-token",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            query:
              'mutation { todoCreate(input: { title: "limited" }) { id } }',
          }),
        }),
      ),
    );

    expect(await response.json()).toMatchObject({
      data: null,
      errors: [
        {
          message: expect.stringContaining("Rate limit exceeded"),
          extensions: { code: "RATE_LIMITED" },
        },
      ],
    });
    expect(todoService.createTodo).not.toHaveBeenCalled();
  });

  it("masks an arbitrary error that claims a safe mutation code", async () => {
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    todoService.createTodo.mockRejectedValue(
      Object.assign(new Error("resolver-detail-must-not-leak"), {
        extensions: { code: "BAD_USER_INPUT" },
      }),
    );
    const response = await productionHandler(
      requestEventFromRequest(
        new Request("http://localhost:3000/api/graphql", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "better-auth.session_token=session-token",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            query: 'mutation { todoCreate(input: { title: "masked" }) { id } }',
          }),
        }),
      ),
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(errorMessages(payload)).toEqual(["Unexpected error."]);
  });

  it("rejects anonymous POST mutations with a safe auth error", async () => {
    const { response, payload } = await execute({
      query: 'mutation { todoDelete(id: "todo") { success } }',
    });

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({
      data: null,
      errors: [
        {
          message: "Authentication required",
          extensions: { code: "UNAUTHENTICATED" },
        },
      ],
    });
    expect(todoService.deleteOwnedTodo).not.toHaveBeenCalled();
  });

  it("enforces the top-level field budget for mutations", async () => {
    const fields = Array.from(
      { length: GRAPHQL_LIMITS.topLevelFields + 1 },
      (_, index) => `m${index}: todoDelete(id: "todo-${index}") { success }`,
    ).join("\n");
    const { payload } = await execute({
      query: `mutation TooWide { ${fields} }`,
    });

    expect(errorMessages(payload)).toContain(
      "Mutation has too many top-level fields.",
    );
    expect(todoService.deleteOwnedTodo).not.toHaveBeenCalled();
  });

  it("masks unexpected resolver details", async () => {
    courseService.listCourseSummaries.mockRejectedValueOnce(
      new Error("database-password-should-never-leak"),
    );

    const { payload } = await execute({
      query: "{ catalog { courses { items { jwId } } } }",
    });

    expect(errorMessages(payload).join(" ")).not.toContain(
      "database-password-should-never-leak",
    );
    expect(errorMessages(payload)).toContain("Unexpected error.");
  });

  it("masks a public resolver error that forges a safe GraphQLError code", async () => {
    const secret = "forged-safe-error-must-not-leak";
    courseService.listCourseSummaries.mockRejectedValueOnce(
      Object.assign(new Error(secret), {
        name: "GraphQLError",
        extensions: { code: "BAD_USER_INPUT" },
        [Symbol.toStringTag]: "GraphQLError",
      }),
    );

    const { payload } = await execute(
      { query: "{ catalog { courses { items { jwId } } } }" },
      true,
    );

    expect(errorMessages(payload)).toEqual(["Unexpected error."]);
    expect(JSON.stringify(payload)).not.toContain(secret);
  });

  it("masks a safe GraphQLError with an untrusted nested originalError", async () => {
    const outerSecret = "nested-graphql-error-must-not-leak";
    const innerSecret = "nested-forged-original-must-not-leak";
    const forgedOriginal = Object.assign(new Error(innerSecret), {
      name: "GraphQLError",
      extensions: { code: "BAD_USER_INPUT" },
      [Symbol.toStringTag]: "GraphQLError",
    });
    courseService.listCourseSummaries.mockRejectedValueOnce(
      new GraphQLError(outerSecret, {
        extensions: { code: "BAD_USER_INPUT" },
        originalError: forgedOriginal,
      }),
    );

    const { payload } = await execute(
      { query: "{ catalog { courses { items { jwId } } } }" },
      true,
    );

    expect(errorMessages(payload)).toEqual(["Unexpected error."]);
    expect(JSON.stringify(payload)).not.toContain(outerSecret);
    expect(JSON.stringify(payload)).not.toContain(innerSecret);
  });

  it("masks a safe GraphQLError with a cyclic originalError chain", async () => {
    const secret = "cyclic-graphql-error-must-not-leak";
    const cyclicError = new GraphQLError(secret, {
      extensions: { code: "BAD_USER_INPUT" },
    });
    Object.defineProperty(cyclicError, "originalError", {
      value: cyclicError,
    });
    courseService.listCourseSummaries.mockRejectedValueOnce(cyclicError);

    const { payload } = await execute(
      { query: "{ catalog { courses { items { jwId } } } }" },
      true,
    );

    expect(errorMessages(payload)).toEqual(["Unexpected error."]);
    expect(JSON.stringify(payload)).not.toContain(secret);
  });

  it("preserves a trusted bad-input GraphQLError in production", async () => {
    const { payload } = await execute(
      {
        query:
          "{ catalog { courses(page: { page: 0 }) { items { jwId } pageInfo { total } } } }",
      },
      true,
    );

    expect(payload).toMatchObject({
      data: null,
      errors: [
        {
          message: expect.stringContaining("page must be between"),
          extensions: { code: "BAD_USER_INPUT" },
        },
      ],
    });
    expect(errorMessages(payload)).not.toContain("Unexpected error.");
  });

  it.each([
    [
      "page",
      `{ catalog { courses(page: { page: ${GRAPHQL_LIMITS.page + 1} }) { pageInfo { total } } } }`,
    ],
    ["root ID", "{ catalog { course(jwId: 0) { jwId } } }"],
    [
      "identifier list",
      `{ catalog { sections(filter: { ids: [${Array.from(
        { length: GRAPHQL_LIMITS.idList + 1 },
        (_, index) => index + 1,
      ).join(",")}] }) { pageInfo { total } } } }`,
    ],
    [
      "search text",
      `{ catalog { courses(filter: { search: "${"x".repeat(
        GRAPHQL_LIMITS.searchChars + 1,
      )}" }) { pageInfo { total } } } }`,
    ],
    [
      "bus datetime",
      '{ catalog { busTimetable(routeId: 1, now: "2026-04-29T08:00:00") { route { id } } } }',
    ],
    [
      "bus version",
      '{ catalog { busTimetable(routeId: 1, versionKey: "../unsafe") { route { id } } } }',
    ],
  ])("rejects invalid %s before service execution", async (_name, query) => {
    const { payload } = await execute({ query });

    expect(errorMessages(payload)).not.toHaveLength(0);
  });

  it("accepts the maximum pageSize and rejects values outside its boundary", async () => {
    const accepted = await execute({
      query: `{ catalog { courses(page: { pageSize: ${GRAPHQL_LIMITS.pageSize} }) { items { jwId } } } }`,
    });
    expect(errorMessages(accepted.payload)).toHaveLength(0);
    expect(courseService.listCourseSummaries).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: { page: 1, pageSize: GRAPHQL_LIMITS.pageSize },
      }),
    );

    for (const pageSize of [0, GRAPHQL_LIMITS.pageSize + 1]) {
      courseService.listCourseSummaries.mockClear();
      const rejected = await execute({
        query: `{ catalog { courses(page: { pageSize: ${pageSize} }) { items { jwId } } } }`,
      });
      expect(errorMessages(rejected.payload)).not.toHaveLength(0);
      expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
    }
  });

  it("graphql.semantic-observability", async () => {
    const { runRegisteredGraphqlOperation } = await import(
      "@/lib/graphql/operation-runner"
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
    const privateValue = "private-query-variable-and-error-detail";
    try {
      for (const transport of ["http", "mcp"] as const) {
        for (const outcome of [
          "success",
          "expected-error",
          "internal-error",
        ] as const) {
          info.mockClear();
          error.mockClear();
          writeDataPoint.mockClear();
          if (outcome === "success") {
            courseService.listCourseSummaries.mockResolvedValue({
              data: [],
              pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
            });
          } else {
            courseService.listCourseSummaries.mockRejectedValue(
              outcome === "expected-error"
                ? new GraphQLError("Safe validation failure", {
                    extensions: { code: "BAD_USER_INPUT" },
                  })
                : new Error(privateValue),
            );
          }
          if (transport === "http") {
            await execute(
              {
                query:
                  "query PrivateSearch($filter: CourseFilter) { catalog { courses(filter: $filter) { items { jwId } } } }",
                variables: { filter: { search: privateValue } },
              },
              true,
            );
          } else {
            await runRegisteredGraphqlOperation({
              operationId: "catalog.course.search.v1",
              variables: { filter: { search: privateValue } },
              locale: "zh-cn",
              principal: { kind: "session", userId: "observation-user" },
              signal: new AbortController().signal,
              requestInfo: {
                requestId: "graphql-unit-test",
                headers: {
                  authorization: "Bearer private-credential",
                  cookie: "private-session",
                },
              },
            });
          }
          const points = writeDataPoint.mock.calls
            .map(([point]) => point)
            .filter((point) => point.blobs?.[0] === "graphql_operation_v3");
          expect(points).toHaveLength(1);
          expect(points[0]).toMatchObject({
            indexes: ["graphql:query"],
            blobs: [
              "graphql_operation_v3",
              "named",
              "query",
              transport === "http" ? "anonymous" : "session",
              outcome === "success" ? "success" : "error",
            ],
            doubles: [
              expect.any(Number),
              1,
              expect.any(Number),
              outcome === "success" ? 0 : 1,
              outcome === "internal-error" ? 1 : 0,
            ],
          });
          const infoRows = info.mock.calls
            .map(([, row]) => row)
            .filter((row) => row?.event === "graphql.operation");
          const errorRows = error.mock.calls
            .map(([, row]) => row)
            .filter((row) => row?.event === "graphql.operation");
          const rows = [...infoRows, ...errorRows];
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({
            authMode: transport === "http" ? "anonymous" : "session",
            requestId: "graphql-unit-test",
            operationName:
              transport === "http" ? "PrivateSearch" : "CatalogCourses",
            operationType: "query",
            topLevelFieldCount: 1,
            estimatedCost: expect.any(Number),
            ioObservedDurationMs: expect.any(Number),
            errorCount: outcome === "success" ? 0 : 1,
            internalErrorCount: outcome === "internal-error" ? 1 : 0,
          });
          expect(errorRows).toHaveLength(outcome === "internal-error" ? 1 : 0);
          const recorded = JSON.stringify({ points, rows });
          for (const secret of [
            privateValue,
            "private-credential",
            "private-session",
            "$filter",
            "Safe validation failure",
          ])
            expect(recorded).not.toContain(secret);
        }
      }
    } finally {
      info.mockRestore();
      error.mockRestore();
    }
  });

  it("graphql.safe-errors", async () => {
    const { runRegisteredGraphqlOperation } = await import(
      "@/lib/graphql/operation-runner"
    );
    const query = "{ catalog { courses { items { jwId } } } }";
    for (const [code, status] of [
      ["UNAUTHENTICATED", 401],
      ["FORBIDDEN", 403],
      ["BAD_USER_INPUT", 400],
      ["NOT_FOUND", 404],
      ["RATE_LIMITED", 429],
      ["SERVICE_UNAVAILABLE", 503],
    ] as const) {
      const message = `Safe ${code}`;
      const error = new GraphQLError(message, {
        extensions: { code, http: { status } },
      });
      courseService.listCourseSummaries.mockRejectedValue(error);
      const http = await execute({ query }, true);
      expect(http.response.status).toBe(status);
      expect(http.payload).toMatchObject({
        errors: [{ message, extensions: { code } }],
      });
      const mcp = await runRegisteredGraphqlOperation({
        operationId: "catalog.course.search.v1",
        variables: {},
        locale: "zh-cn",
        principal: { kind: "session", userId: "error-user" },
        signal: new AbortController().signal,
      });
      expect(mcp).toMatchObject({
        success: false,
        errors: [{ message, extensions: { code, http: { status } } }],
      });
    }
    const secret = "private-database-credential";
    const forged = Object.assign(new Error(secret), {
      name: "GraphQLError",
      extensions: { code: "BAD_USER_INPUT" },
      [Symbol.toStringTag]: "GraphQLError",
    });
    const nested = new GraphQLError(secret, {
      extensions: { code: "FORBIDDEN" },
      originalError: forged,
    });
    const cyclic = new GraphQLError(secret, {
      extensions: { code: "NOT_FOUND" },
    });
    Object.defineProperty(cyclic, "originalError", { value: cyclic });
    for (const error of [new Error(secret), forged, nested, cyclic]) {
      courseService.listCourseSummaries.mockRejectedValue(error);
      const http = await execute({ query }, true);
      const mcp = await runRegisteredGraphqlOperation({
        operationId: "catalog.course.search.v1",
        variables: {},
        locale: "zh-cn",
        principal: { kind: "session", userId: "error-user" },
        signal: new AbortController().signal,
      });
      for (const payload of [http.payload, mcp]) {
        expect(payload).toMatchObject({
          errors: [
            {
              message: "Unexpected error.",
              extensions: { code: "INTERNAL_SERVER_ERROR" },
            },
          ],
        });
        expect(JSON.stringify(payload)).not.toContain(secret);
      }
    }
  });

  it("graphql.mutation-timeout-ambiguity", async () => {
    const { runRegisteredGraphqlOperation } = await import(
      "@/lib/graphql/operation-runner"
    );
    authCore.getSessionFromHeaders.mockResolvedValue({
      user: { id: "session-user" },
    });
    vi.useFakeTimers();
    try {
      for (const transport of ["http", "mcp"] as const) {
        for (const stop of ["timeout", "cancel"] as const) {
          const release = createDeferred<void>();
          const started = createDeferred<void>();
          const completed = createDeferred<void>();
          let committed = false;
          todoService.createTodo.mockImplementation(async () => {
            started.resolve();
            await release.promise;
            committed = true;
            completed.resolve();
            return { id: "late-write" };
          });
          const controller = new AbortController();
          const event = sessionRequestEvent({
            query:
              'mutation { todoCreate(input: { title: "Late write" }) { id } }',
          });
          event.request = new Request(event.request, {
            signal: controller.signal,
          });
          let settled = false;
          const execution =
            transport === "http"
              ? productionHandler(event)
              : runRegisteredGraphqlOperation({
                  operationId: "workspace.todo.create.v1",
                  confirmed: true,
                  variables: { input: { title: "Late write" } },
                  locale: "zh-cn",
                  principal: { kind: "session", userId: "session-user" },
                  signal: controller.signal,
                });
          const outcome = execution.then(
            (value) => {
              settled = true;
              return value;
            },
            (error: unknown) => {
              settled = true;
              return error;
            },
          );
          try {
            await started.promise;
            if (stop === "cancel")
              controller.abort(new DOMException("Cancelled", "AbortError"));
            await vi.advanceTimersByTimeAsync(stop === "timeout" ? 5000 : 1);
            expect(settled, `${transport}/${stop} must stop waiting`).toBe(
              true,
            );
            expect(committed).toBe(false);
            const result = await outcome;
            if (result instanceof Response) {
              expect(result.status).toBeGreaterThanOrEqual(400);
            } else {
              expect(result).toMatchObject({
                code:
                  stop === "timeout" ? "REQUEST_TIMEOUT" : "REQUEST_CANCELLED",
              });
            }
          } finally {
            release.resolve();
            await completed.promise;
            await outcome;
          }
          expect(committed).toBe(true);
        }
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("graphql.request-timeout", async () => {
    expect(GRAPHQL_LIMITS.timeoutMs).toBe(5000);
    vi.useFakeTimers();
    const pending = createDeferred<{
      data: unknown[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>();
    const started = createDeferred<void>();
    courseService.listCourseSummaries.mockImplementation(() => {
      started.resolve(undefined);
      return pending.promise;
    });
    try {
      const execution = execute(
        { query: "{ catalog { courses { items { jwId } } } }" },
        true,
      );
      await started.promise;
      await vi.advanceTimersByTimeAsync(5000);
      const result = await execution;
      expect(result.response.status).toBe(504);
      expect(result.payload).toMatchObject({
        errors: [{ extensions: { code: "REQUEST_TIMEOUT" } }],
      });
    } finally {
      pending.resolve({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });
      await vi.runAllTimersAsync();
      vi.useRealTimers();
    }
  });

  it("graphql.request-budgets", async () => {
    expect(GRAPHQL_LIMITS.bodyBytes).toBe(65_536);
    const body = JSON.stringify({
      query: "{ catalog { courses { items { jwId } } } } #课",
    });
    const bytes = new TextEncoder().encode(body).byteLength;
    const accepted = await execute(body + " ".repeat(65_536 - bytes));
    expect(errorMessages(accepted.payload)).toEqual([]);
    courseService.listCourseSummaries.mockClear();
    const { response, payload } = await execute(
      body + " ".repeat(65_537 - bytes),
    );
    expect(response.status).toBe(413);
    expect(payload).toMatchObject({
      errors: [{ extensions: { code: "REQUEST_TOO_LARGE" } }],
    });
    expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
  });

  it("logs unexpected transport failures with the request id", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("https://example.test/api/graphql", {
      method: "POST",
      body: new ReadableStream({
        pull(controller) {
          controller.error(new TypeError("stream failed"));
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await developmentHandler(requestEventFromRequest(request));

    expect(response.status).toBe(500);
    expect(errorLog).toHaveBeenCalledWith(
      "[app]",
      expect.objectContaining({
        event: "graphql.request.failed",
        phase: "transport",
        requestId: "graphql-unit-test",
      }),
      expect.objectContaining({ name: "TypeError" }),
    );
  });

  it("graphql.request-single-operation", async () => {
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
          '{ catalog { busTimetable(routeId: 1, now: "2026-04-29T08:00:00+08:00") { route { id } } } }',
      },
    ],
    [
      "variable",
      {
        query:
          "query Timetable($now: DateTime!) { catalog { busTimetable(routeId: 1, now: $now) { route { id } } } }",
        variables: { now: "2026-04-29T08:00:00+08:00" },
      },
    ],
  ])("coerces a strict zoned DateTime from an %s", async (_name, body) => {
    const { payload } = await execute(body);

    expect(payload).toEqual({ data: { catalog: { busTimetable: null } } });
    expect(busService.getBusRouteTimetable).toHaveBeenCalledWith(
      expect.objectContaining({ now: "2026-04-29T08:00:00+08:00" }),
    );
  });

  it.each([
    [
      "inline literal",
      {
        query:
          '{ catalog { busTimetable(routeId: 1, now: "2026-04-31T08:00:00+08:00") { route { id } } } }',
      },
    ],
    [
      "variable",
      {
        query:
          "query Timetable($now: DateTime!) { catalog { busTimetable(routeId: 1, now: $now) { route { id } } } }",
        variables: { now: "2026-04-29T08:00:00" },
      },
    ],
  ])("rejects an invalid zoned DateTime from an %s", async (_name, body) => {
    const { payload } = await execute(body);

    expect(errorMessages(payload)).not.toHaveLength(0);
    expect(busService.getBusRouteTimetable).not.toHaveBeenCalled();
  });

  it("graphql.production-introspection", async () => {
    const { payload } = await execute(
      { query: "{ __schema { queryType { name } } }" },
      true,
    );

    expect(errorMessages(payload)).not.toHaveLength(0);
    expect(payload).not.toHaveProperty("data.__schema");
  });

  it("graphql.request-top-level", async () => {
    expect(GRAPHQL_LIMITS.topLevelFields).toBe(10);
    for (const count of [10, 11]) {
      courseService.listCourseSummaries.mockClear();
      const query = `{ ${Array.from({ length: count }, (_, index) => `q${index}: catalog { courses { items { jwId } } }`).join(" ")} }`;
      const { payload } = await execute({ query });
      if (count === 10) expect(errorMessages(payload)).toEqual([]);
      else {
        expect(errorMessages(payload).join(" ")).toContain(
          "too many top-level fields",
        );
        expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
      }
    }
  });

  it("graphql.request-aliases", async () => {
    expect(GRAPHQL_LIMITS.aliases).toBe(15);
    for (const count of [15, 16]) {
      courseService.listCourseSummaries.mockClear();
      const query = `{ catalog { courses { ${Array.from({ length: count }, (_, index) => `a${index}: items { jwId }`).join(" ")} } } }`;
      const { payload } = await execute({ query });
      if (count === 15) expect(errorMessages(payload)).toEqual([]);
      else {
        expect(errorMessages(payload)).not.toHaveLength(0);
        expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
      }
    }
  });

  it("graphql.request-directives", async () => {
    expect(GRAPHQL_LIMITS.directives).toBe(10);
    for (const count of [10, 11]) {
      courseService.listCourseSummaries.mockClear();
      const query = `{ catalog { courses { items { ${Array.from({ length: count }, (_, index) => `f${index}: code @skip(if: false)`).join(" ")} } } } }`;
      const { payload } = await execute({ query });
      if (count === 10) expect(errorMessages(payload)).toEqual([]);
      else {
        expect(errorMessages(payload)).not.toHaveLength(0);
        expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
      }
    }
  });

  it("graphql.request-tokens", async () => {
    expect(GRAPHQL_LIMITS.tokens).toBe(1000);
    // Eleven fixed punctuation/name tokens surround the repeated field tokens.
    // Repeated selections may fail cost validation; the parser must still accept
    // exactly 1000 lexical tokens and reject 1001 with the syntax error.
    const query = (tokens: number) =>
      `{ catalog { courses { items { ${"code ".repeat(tokens - 11)} } } } }`;
    const accepted = await execute({ query: query(1000) });
    expect(errorMessages(accepted.payload).join(" ")).not.toContain(
      "Syntax Error",
    );
    courseService.listCourseSummaries.mockClear();
    const rejected = await execute({ query: query(1001) });
    expect(errorMessages(rejected.payload).join(" ")).toContain("Syntax Error");
    expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
  });

  it("graphql.request-depth", async () => {
    expect(GRAPHQL_LIMITS.depth).toBe(8);
    const { payload } = await execute({
      query: `{
        __type(name: "Course") {
          fields {
            type {
              ofType {
                ofType {
                  ofType {
                    ofType {
                      ofType {
                        ofType {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
    });

    expect(errorMessages(payload).join(" ")).toContain(
      "Query depth limit exceeded.",
    );
    expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
  });

  it("graphql.request-cost", async () => {
    expect(GRAPHQL_LIMITS.cost).toBe(5000);
    const { payload } = await execute({
      query: `
        query ExpensiveCatalog($page: PageInput) {
          catalog {
            first: courses(page: $page) {
              ...FullCoursePage
            }
            second: courses(page: $page) {
              ...FullCoursePage
            }
          }
        }

        fragment FullCoursePage on CoursePage {
          items {
            id
            jwId
            code
            nameCn
            nameEn
            category { id nameCn nameEn }
            classType { id nameCn nameEn }
            classify { id nameCn nameEn }
            educationLevel { id nameCn nameEn }
            gradation { id nameCn nameEn }
            type { id nameCn nameEn }
          }
          pageInfo { page pageSize total totalPages }
        }
      `,
      variables: {
        page: { pageSize: GRAPHQL_LIMITS.pageSize },
      },
    });

    expect(errorMessages(payload)).toContain("Query cost limit exceeded.");
    expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
  });

  it("weights every Workspace page field by variable pageSize", async () => {
    const { payload } = await execute({
      query: /* GraphQL */ `
        query ExpensiveViewer($page: PageInput) {
          workspace {
            todos(page: $page) {
              items {
                id
                title
                content
                priority
                completed
                dueAt
                createdAt
                updatedAt
              }
              pageInfo {
                page
                pageSize
                total
                totalPages
              }
            }
            subscribedSections(page: $page) {
              items {
                kind
                section {
                id
                jwId
                code
                credits
                period
                periodsPerWeek
                timesPerWeek
                stdCount
                limitCount
                remark
                }
              }
            }
            homeworks(page: $page) {
              items {
                id
                title
                isMajor
                requiresTeam
                publishedAt
                submissionStartAt
                submissionDueAt
                createdAt
                updatedAt
                completed
                completedAt
                commentCount
              }
            }
            schedules(page: $page) {
              items {
                id
                periods
                date
                weekday
                startTime
                endTime
                experiment
                customPlace
                lessonType
                weekIndex
                startUnit
                endUnit
              }
            }
            exams(page: $page) {
              items {
                id
                jwId
                examType
                startTime
                endTime
                examDate
                examTakeCount
                examMode
              }
            }
          }
        }
      `,
      variables: {
        page: { pageSize: GRAPHQL_LIMITS.pageSize },
      },
    });

    expect(errorMessages(payload)).toContain("Query cost limit exceeded.");
  });

  it("weights nested Workspace page fields before resolver execution", async () => {
    const { payload } = await execute({
      query: /* GraphQL */ `
        query ExpensiveNestedViewer($nestedPage: PageInput) {
          workspace {
            schedules(page: { pageSize: 10 }) {
              items {
                teachers(page: $nestedPage) {
                  items {
                    id
                  }
                }
              }
            }
          }
        }
      `,
      variables: {
        nestedPage: { pageSize: GRAPHQL_LIMITS.pageSize },
      },
    });

    expect(errorMessages(payload)).toContain("Query cost limit exceeded.");
  });
});
