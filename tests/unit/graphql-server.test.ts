import type { RequestEvent } from "@sveltejs/kit";
import { GraphQLError } from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";

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

  it("keeps GraphiQL development-only and executes public GET queries", async () => {
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
      "{ courses { items { jwId } pageInfo { total } } }",
    );
    const queryResponse = await productionHandler(
      requestEventFromRequest(
        new Request(`https://example.test/api/graphql?query=${query}`),
      ),
    );
    expect(await queryResponse.json()).toEqual({
      data: { courses: { items: [], pageInfo: { total: 0 } } },
    });
    expect(courseService.listCourseSummaries).toHaveBeenCalledTimes(1);
  });

  it("rejects mutation operations over GET and serves CORS preflight", async () => {
    const mutation = encodeURIComponent(
      'mutation Forbidden { deleteTodo(id: "test") { success } }',
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
              'mutation { createTodo(input: { title: "  Session todo  " }) { id } }',
          }),
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      data: { createTodo: { id: "todo-created" } },
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
              'mutation { updateTodo(id: "todo-updated", input: { content: null }) { id } }',
          }),
        }),
      ),
    );

    expect(await response.json()).toEqual({
      data: { updateTodo: { id: "todo-updated" } },
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
              upsertDescription(input: $input) {
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
          "user-agent": "graphql-unit-agent",
          "x-forwarded-for": "192.0.2.40",
        },
      ),
    );

    expect(await response.json()).toEqual({
      data: {
        upsertDescription: {
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
        ipAddress: "192.0.2.40",
        source: "graphql",
        userAgent: "graphql-unit-agent",
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
            upsertDescription(input: $input) {
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
            query: 'mutation { createTodo(input: { title: "   " }) { id } }',
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
            query: 'mutation { deleteTodo(id: "missing") { success } }',
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
              'mutation { createTodo(input: { title: "limited" }) { id } }',
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
            query: 'mutation { createTodo(input: { title: "masked" }) { id } }',
          }),
        }),
      ),
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(errorMessages(payload)).toEqual(["Unexpected error."]);
  });

  it("rejects anonymous POST mutations with a safe auth error", async () => {
    const { response, payload } = await execute({
      query: 'mutation { deleteTodo(id: "todo") { success } }',
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
      (_, index) => `m${index}: deleteTodo(id: "todo-${index}") { success }`,
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
      query: "{ courses { items { jwId } } }",
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
      { query: "{ courses { items { jwId } } }" },
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
      { query: "{ courses { items { jwId } } }" },
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
      { query: "{ courses { items { jwId } } }" },
      true,
    );

    expect(errorMessages(payload)).toEqual(["Unexpected error."]);
    expect(JSON.stringify(payload)).not.toContain(secret);
  });

  it("preserves a trusted bad-input GraphQLError in production", async () => {
    const { payload } = await execute(
      {
        query:
          "{ courses(page: { page: 0 }) { items { jwId } pageInfo { total } } }",
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

  it("accepts the maximum pageSize and rejects values outside its boundary", async () => {
    const accepted = await execute({
      query: `{ courses(page: { pageSize: ${GRAPHQL_LIMITS.pageSize} }) { items { jwId } } }`,
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
        query: `{ courses(page: { pageSize: ${pageSize} }) { items { jwId } } }`,
      });
      expect(errorMessages(rejected.payload)).not.toHaveLength(0);
      expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
    }
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

  it("rejects an operation that independently exceeds maxDepth", async () => {
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

  it("rejects variable pageSize-weighted cost before service execution", async () => {
    const { payload } = await execute({
      query: `
        query ExpensiveCatalog($page: PageInput) {
          first: courses(page: $page) {
            ...FullCoursePage
          }
          second: courses(page: $page) {
            ...FullCoursePage
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

  it("weights every Viewer page field by variable pageSize", async () => {
    const { payload } = await execute({
      query: /* GraphQL */ `
        query ExpensiveViewer($page: PageInput) {
          viewer {
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

  it("weights nested Viewer page fields before resolver execution", async () => {
    const { payload } = await execute({
      query: /* GraphQL */ `
        query ExpensiveNestedViewer($nestedPage: PageInput) {
          viewer {
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
