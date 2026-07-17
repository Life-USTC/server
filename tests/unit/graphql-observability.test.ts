import type { RequestEvent } from "@sveltejs/kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const courseService = vi.hoisted(() => ({
  listCourseSummaries: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-summary-read-model", () => ({
  listCourseSummaries: courseService.listCourseSummaries,
}));

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
        ...CatalogRoot
      }
      fragment CatalogRoot on Query {
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
    await execute({ query: "{ courses { items { jwId } } }" });

    expect(writeDataPoint).toHaveBeenCalledTimes(2);
    expect(writeDataPoint).toHaveBeenNthCalledWith(1, {
      indexes: ["graphql:query"],
      blobs: [
        "graphql_operation",
        "Catalog",
        "query",
        "anonymous",
        "graphql-observation-test",
      ],
      doubles: [expect.any(Number), 1, 35, 0],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ["graphql:query"],
      blobs: [
        "graphql_operation",
        "anonymous",
        "query",
        "anonymous",
        "graphql-observation-test",
      ],
      doubles: [expect.any(Number), 1, 100, 0],
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

  it("records parse, validation, and resolver errors returned with HTTP 200", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();

    const parseFailure = await execute({ query: "query Broken { courses(" });
    const validationFailure = await execute({ query: "{ missingField }" });
    courseService.listCourseSummaries.mockRejectedValueOnce(
      new Error("private-resolver-detail"),
    );
    const resolverFailure = await execute({
      query: "{ courses { items { jwId } } }",
    });

    expect(parseFailure.response.status).toBe(200);
    expect(validationFailure.response.status).toBe(200);
    expect(resolverFailure.response.status).toBe(200);
    expect(writeDataPoint).toHaveBeenCalledTimes(3);
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        indexes: ["graphql:unknown"],
        doubles: [expect.any(Number), 0, 0, 1],
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        indexes: ["graphql:query"],
        doubles: [expect.any(Number), 1, 1, 1],
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        indexes: ["graphql:query"],
        doubles: [expect.any(Number), 1, 100, 1],
      }),
    );
  });

  it("records the same variable-weighted cost used to reject execution", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = installAnalytics();

    const { payload } = await execute({
      query: /* GraphQL */ `
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
      variables: { page: { pageSize: 100 } },
    });

    expect(payload).toHaveProperty("errors");
    expect(courseService.listCourseSummaries).not.toHaveBeenCalled();
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        indexes: ["graphql:query"],
        doubles: [expect.any(Number), 2, 9000, 1],
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

    const { payload } = await execute(
      {
        query:
          "query Safe($search: String) { courses(filter: { search: $search }) { items { jwId } } }",
        variables: { search: "private-variable-value" },
      },
      {
        authorization: "Bearer private-access-token",
        cookie: "better-auth.session_token=private-session-cookie",
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
    expect(recorded).not.toContain("filter:");
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["Safe", "anonymous"]),
      }),
    );
    expect(JSON.stringify(payload)).not.toContain("private-resolver-detail");
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
      query: "{ courses { items { jwId } } }",
    });

    expect(response.status).toBe(200);
    expect(payload).toHaveProperty("data");
  });
});
