import type { RequestEvent } from "@sveltejs/kit";
import { createYoga } from "graphql-yoga";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const courseService = vi.hoisted(() => ({
  listCourseSummaries: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-summary-read-model", () => ({
  listCourseSummaries: courseService.listCourseSummaries,
}));

import type { GraphqlPrincipal } from "@/lib/graphql/auth";
import type {
  GraphqlContext,
  GraphqlServerContext,
} from "@/lib/graphql/context";
import { createGraphqlLoaders } from "@/lib/graphql/loaders";
import { createGraphqlObservabilityPlugin } from "@/lib/graphql/observability";
import { graphqlSchema } from "@/lib/graphql/schema";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";

const handler = createGraphqlRequestHandler(false);

function requestEvent(
  body: unknown,
  headers: Record<string, string> = {},
): RequestEvent {
  return {
    request: new Request("https://example.test/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "graphql-observation-test",
    },
  } as unknown as RequestEvent;
}

async function execute(
  body: unknown,
  headers?: Record<string, string>,
): Promise<{ payload: Record<string, unknown>; response: Response }> {
  const response = await handler(requestEvent(body, headers));
  return {
    payload: (await response.json()) as Record<string, unknown>,
    response,
  };
}

function contextWithPrincipal(
  request: Request,
  principal: GraphqlPrincipal,
): GraphqlContext {
  return {
    loaders: createGraphqlLoaders("zh-cn"),
    locale: "zh-cn",
    principal,
    request,
  };
}

async function executeWithContext(
  body: unknown,
  createContext: (request: Request) => GraphqlContext | Promise<GraphqlContext>,
  {
    headers = {},
    requestId = "graphql-observation-test",
  }: {
    headers?: Record<string, string>;
    requestId?: string;
  } = {},
) {
  const yoga = createYoga<GraphqlServerContext, GraphqlContext>({
    schema: graphqlSchema,
    graphqlEndpoint: "/api/graphql",
    fetchAPI: { Response },
    context: ({ request }) => createContext(request),
    graphiql: false,
    logging: false,
    maskedErrors: true,
    plugins: [createGraphqlObservabilityPlugin()],
  });
  const response = await yoga.fetch(
    "https://example.test/api/graphql",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
    {
      locals: {
        locale: "zh-cn",
        requestId,
      },
    },
  );
  return {
    payload: (await response.json()) as Record<string, unknown>,
    response,
  };
}

function installAnalytics() {
  const writeDataPoint = vi.fn();
  setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
  return writeDataPoint;
}

describe("GraphQL semantic observability", () => {
  beforeEach(() => {
    courseService.listCourseSummaries.mockReset();
    courseService.listCourseSummaries.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
      },
    });
  });

  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    vi.restoreAllMocks();
  });

  it("records named and anonymous operations exactly once", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();
    const namedQuery = /* GraphQL */ `
      query Catalog($page: PageInput) {
        catalog {
          ...CatalogRoot
        }
      }
      fragment CatalogRoot on Catalog {
        courses(page: $page) {
          items {
            jwId
          }
        }
      }
    `;

    await execute({
      query: namedQuery,
      variables: { page: { pageSize: 7 } },
    });
    await execute({ query: "{ catalog { courses { items { jwId } } } }" });

    expect(writeDataPoint).toHaveBeenCalledTimes(2);
    expect(writeDataPoint).toHaveBeenNthCalledWith(1, {
      indexes: ["graphql:query"],
      blobs: [
        "graphql_operation_v2",
        "Catalog",
        "query",
        "anonymous",
        "graphql-observation-test",
      ],
      doubles: [expect.any(Number), 1, 37, 0, 0],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ["graphql:query"],
      blobs: [
        "graphql_operation_v2",
        "anonymous",
        "query",
        "anonymous",
        "graphql-observation-test",
      ],
      doubles: [expect.any(Number), 1, 102, 0, 0],
    });
    expect(
      info.mock.calls.filter(
        ([prefix, value]) =>
          prefix === "[app]" &&
          typeof value === "object" &&
          value !== null &&
          "event" in value &&
          value.event === "graphql.operation",
      ),
    ).toHaveLength(2);
  });

  it("records the successful principal kind and prefers the locals request ID", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();
    const principals: Array<[GraphqlPrincipal["kind"], GraphqlPrincipal]> = [
      ["anonymous", { kind: "anonymous" }],
      ["session", { kind: "session", userId: "session-user" }],
      [
        "oauth",
        {
          kind: "oauth",
          userId: "oauth-user",
          scopes: new Set(["account.profile:read"]),
          resource: "https://example.test/api/graphql",
        },
      ],
    ];

    for (const [authMode, principal] of principals) {
      await executeWithContext(
        {
          query: `query ${authMode}Mode { catalog { courses { items { jwId } } } }`,
        },
        (request) => contextWithPrincipal(request, principal),
        {
          headers: { "x-request-id": "ignored-header-request-id" },
          requestId: `${authMode}-locals-request-id`,
        },
      );
    }

    expect(writeDataPoint).toHaveBeenCalledTimes(3);
    principals.forEach(([authMode], index) => {
      expect(writeDataPoint).toHaveBeenNthCalledWith(index + 1, {
        indexes: ["graphql:query"],
        blobs: [
          "graphql_operation_v2",
          `${authMode}Mode`,
          "query",
          authMode,
          `${authMode}-locals-request-id`,
        ],
        doubles: [expect.any(Number), 1, 102, 0, 0],
      });
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "ignored-header-request-id",
    );
  });

  it("does not trust a request ID header when server locals are absent", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();

    await executeWithContext(
      {
        query: "query HeaderOnly { catalog { courses { items { jwId } } } }",
      },
      (request) => contextWithPrincipal(request, { kind: "anonymous" }),
      {
        headers: { "x-request-id": "client-controlled-request-id" },
        requestId: "",
      },
    );

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["graphql:query"],
      blobs: [
        "graphql_operation_v2",
        "HeaderOnly",
        "query",
        "anonymous",
        "unknown",
      ],
      doubles: [expect.any(Number), 1, 102, 0, 0],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "client-controlled-request-id",
    );
  });

  it("records parse, validation, and resolver errors returned with HTTP 200", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();

    const parseFailure = await execute({ query: "query Broken { courses(" });
    const validationFailure = await execute({ query: "{ missingField }" });
    courseService.listCourseSummaries.mockRejectedValueOnce(
      new Error("private-resolver-detail"),
    );
    const resolverFailure = await execute({
      query: "{ catalog { courses { items { jwId } } } }",
    });

    expect(parseFailure.response.status).toBe(200);
    expect(validationFailure.response.status).toBe(200);
    expect(resolverFailure.response.status).toBe(200);
    expect(writeDataPoint).toHaveBeenCalledTimes(3);
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        indexes: ["graphql:unknown"],
        doubles: [expect.any(Number), 0, 0, 1, 0],
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        indexes: ["graphql:query"],
        doubles: [expect.any(Number), 1, 1, 1, 0],
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        indexes: ["graphql:query"],
        doubles: [expect.any(Number), 1, 102, 1, 1],
      }),
    );
    expect(
      info.mock.calls.filter(
        ([prefix, value]) =>
          prefix === "[app]" &&
          typeof value === "object" &&
          value !== null &&
          "event" in value &&
          value.event === "graphql.operation",
      ),
    ).toHaveLength(2);
    expect(
      error.mock.calls.filter(
        ([prefix, value]) =>
          prefix === "[app]" &&
          typeof value === "object" &&
          value !== null &&
          "event" in value &&
          value.event === "graphql.operation" &&
          "internalErrorCount" in value &&
          value.internalErrorCount === 1,
      ),
    ).toHaveLength(1);
  });

  it("classifies context failures from safe auth signals without leaking request data", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();
    const privateBearerCookie = "private-bearer-session-cookie";
    const privateSessionCookie = "private-context-session-cookie";
    const privateBody = "private-context-body";
    const bearerFailure = await execute(
      {
        query: "query BearerFailure { catalog { courses { items { jwId } } } }",
        extensions: {
          privateBody,
        },
      },
      {
        authorization: "Bearer",
        cookie: `better-auth.session_token=${privateBearerCookie}`,
      },
    );
    const sessionFailure = await execute(
      {
        query:
          "query SessionFailure { catalog { courses { items { jwId } } } }",
      },
      {
        cookie: `better-auth.session_token=${privateSessionCookie}`,
      },
    );
    const privateContextDetail = "private-context-detail";
    const unknownFailure = await executeWithContext(
      {
        query:
          "query UnknownFailure { catalog { courses { items { jwId } } } }",
      },
      () => {
        throw new Error(privateContextDetail);
      },
      { requestId: "graphql-context-unknown-test" },
    );

    expect(bearerFailure.response.status).toBe(401);
    expect(sessionFailure.response.status).toBe(403);
    expect(unknownFailure.response.status).toBe(500);
    expect(writeDataPoint).toHaveBeenCalledTimes(3);
    [
      ["BearerFailure", "oauth", "graphql-observation-test"],
      ["SessionFailure", "session", "graphql-observation-test"],
      ["UnknownFailure", "unknown", "graphql-context-unknown-test"],
    ].forEach(([operationName, authMode, requestId], index) => {
      expect(writeDataPoint).toHaveBeenNthCalledWith(index + 1, {
        indexes: ["graphql:query"],
        blobs: [
          "graphql_operation_v2",
          operationName,
          "query",
          authMode,
          requestId,
        ],
        doubles: [
          expect.any(Number),
          1,
          102,
          1,
          operationName === "UnknownFailure" ? 1 : 0,
        ],
      });
    });
    const recorded = JSON.stringify([
      writeDataPoint.mock.calls,
      bearerFailure.payload,
      sessionFailure.payload,
      unknownFailure.payload,
    ]);
    expect(recorded).not.toContain(privateBearerCookie);
    expect(recorded).not.toContain(privateSessionCookie);
    expect(recorded).not.toContain(privateBody);
    expect(recorded).not.toContain(privateContextDetail);
  });

  it("records the same variable-weighted cost used to reject execution", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();

    const { payload } = await execute({
      query: /* GraphQL */ `
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
      variables: { page: { pageSize: 100 } },
    });

    expect(payload).toHaveProperty("errors");
    expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        indexes: ["graphql:query"],
        doubles: [expect.any(Number), 1, 9002, 1, 0],
      }),
    );
  });

  it("does not record query text, variables, credentials, or error details", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();
    courseService.listCourseSummaries.mockRejectedValueOnce(
      new Error("private-resolver-detail"),
    );

    const privateBody = "private-body-value";
    const { payload } = await executeWithContext(
      {
        query:
          "query Safe($search: String) { catalog { courses(filter: { search: $search }) { items { jwId } } } }",
        variables: { search: "private-variable-value" },
        extensions: { privateBody },
      },
      (request) =>
        contextWithPrincipal(request, {
          kind: "oauth",
          userId: "private-user-id",
          scopes: new Set(),
          resource: "https://example.test/api/graphql",
        }),
      {
        headers: {
          authorization: "Bearer private-access-token",
          cookie: "better-auth.session_token=private-session-cookie",
        },
      },
    );

    const recorded = JSON.stringify([
      writeDataPoint.mock.calls,
      info.mock.calls,
      error.mock.calls,
    ]);
    expect(recorded).not.toContain("private-variable-value");
    expect(recorded).not.toContain("private-access-token");
    expect(recorded).not.toContain("private-session-cookie");
    expect(recorded).not.toContain("private-resolver-detail");
    expect(recorded).not.toContain(privateBody);
    expect(recorded).not.toContain("filter:");
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["Safe", "oauth"]),
      }),
    );
    expect(JSON.stringify(payload)).not.toContain("private-resolver-detail");
  });

  it("records mutation semantics without leaking mutation variables", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({
      ANALYTICS: { writeDataPoint },
      USER_WRITE_RATE_LIMITER: {
        limit: vi.fn().mockResolvedValue({ success: true }),
      },
    });
    const privateTitle = `private-mutation-variable-${"x".repeat(200)}`;

    const { payload } = await executeWithContext(
      {
        query: /* GraphQL */ `
          mutation PrivateTodoMutation($title: String!) {
            todoCreate(input: { title: $title }) {
              id
            }
          }
        `,
        variables: { title: privateTitle },
      },
      (request) =>
        contextWithPrincipal(request, {
          kind: "session",
          userId: "private-session-user",
        }),
      { requestId: "graphql-mutation-observation-test" },
    );

    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["graphql:mutation"],
      blobs: [
        "graphql_operation_v2",
        "PrivateTodoMutation",
        "mutation",
        "session",
        "graphql-mutation-observation-test",
      ],
      doubles: [expect.any(Number), 1, 3, 1, 1],
    });
    expect(
      JSON.stringify([
        writeDataPoint.mock.calls,
        info.mock.calls,
        error.mock.calls,
        payload,
      ]),
    ).not.toContain(privateTitle);
  });

  it("keeps the GraphQL response available when Analytics Engine fails", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    setCloudflareRuntimeEnv({
      ANALYTICS: {
        writeDataPoint: vi.fn(() => {
          throw new Error("analytics unavailable");
        }),
      },
    });

    const { payload, response } = await execute({
      query: "{ catalog { courses { items { jwId } } } }",
    });

    expect(response.status).toBe(200);
    expect(payload).toHaveProperty("data");
  });

  it("keeps the response available and records Analytics when logging fails", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {
      throw new Error("log sink unavailable");
    });
    const writeDataPoint = installAnalytics();

    const { payload, response } = await execute({
      query: "{ catalog { courses { items { jwId } } } }",
    });

    expect(response.status).toBe(200);
    expect(payload).toHaveProperty("data");
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
  });
});
