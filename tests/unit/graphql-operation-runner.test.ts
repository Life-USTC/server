import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const catalogService = vi.hoisted(() => ({
  getCurrentSemester: vi.fn(),
}));

vi.mock(
  "@/features/catalog/server/academic-metadata-read-model",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("@/features/catalog/server/academic-metadata-read-model")
      >();
    return {
      ...original,
      getCurrentSemester: catalogService.getCurrentSemester,
    };
  },
);

import {
  type RegisteredGraphqlOperationError,
  runRegisteredGraphqlOperation,
} from "@/lib/graphql/operation-runner";

const oauthPrincipal = {
  kind: "oauth" as const,
  userId: "runner-test-user",
  scopes: new Set(["todo:read", "todo:write"]),
  resource: "https://example.test/api/mcp",
  clientId: "runner-test-client",
};

function run(
  operationId: string,
  input: {
    confirmed?: boolean;
    scopes?: Set<string>;
    variables?: unknown;
  } = {},
) {
  return runRegisteredGraphqlOperation({
    operationId,
    confirmed: input.confirmed,
    locale: "zh-cn",
    principal: {
      ...oauthPrincipal,
      scopes: input.scopes ?? oauthPrincipal.scopes,
    },
    requestInfo: {
      headers: {
        authorization: "Bearer must-not-reach-graphql",
        cookie: "private-session-cookie",
        "user-agent": "runner-test",
      },
      requestId: "graphql-runner-test",
      url: "https://example.test/api/mcp",
    },
    signal: new AbortController().signal,
    variables: input.variables,
  });
}

describe("registered GraphQL operation runner", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    catalogService.getCurrentSemester.mockReset();
    vi.restoreAllMocks();
  });

  it("executes a fixed pre-parsed operation without accepting a document", async () => {
    catalogService.getCurrentSemester.mockResolvedValue({
      id: 1,
      jwId: 202601,
      code: "2026SP",
      nameCn: "2026 春",
      startDate: new Date("2026-02-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
    });

    await expect(run("catalog.current_semester.v1")).resolves.toMatchObject({
      success: true,
      operationId: "catalog.current_semester.v1",
      operationName: "CatalogCurrentSemester",
      operationType: "query",
      data: {
        currentSemester: {
          jwId: 202601,
          code: "2026SP",
        },
      },
    });
  });

  it("rejects unknown operations, extra variables, and invalid variables", async () => {
    await expect(run("unknown.operation.v1")).rejects.toMatchObject({
      code: "UNKNOWN_OPERATION",
    } satisfies Partial<RegisteredGraphqlOperationError>);
    await expect(
      run("viewer.todos.v1", {
        variables: {
          document: "query Arbitrary { viewer { profile { id } } }",
        },
      }),
    ).rejects.toMatchObject({
      code: "BAD_USER_INPUT",
      message: "Unknown variable: document.",
    } satisfies Partial<RegisteredGraphqlOperationError>);
    await expect(
      run("catalog.course.v1", { variables: {} }),
    ).rejects.toMatchObject({
      code: "BAD_USER_INPUT",
    } satisfies Partial<RegisteredGraphqlOperationError>);
    await expect(
      run("viewer.overview.v1", {
        scopes: new Set(["dashboard:read"]),
        variables: { atTime: "2026-07-20" },
      }),
    ).rejects.toMatchObject({
      code: "BAD_USER_INPUT",
      message: expect.stringContaining(
        "DateTime must be an ISO 8601 datetime with a timezone.",
      ),
    } satisfies Partial<RegisteredGraphqlOperationError>);
  });

  it("enforces exact scopes and mutation confirmation before execution", async () => {
    await expect(
      run("viewer.todos.v1", {
        scopes: new Set(["homework:read"]),
        variables: {},
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      requiredScopes: ["todo:read"],
    } satisfies Partial<RegisteredGraphqlOperationError>);
    await expect(
      run("todo.create.v1", {
        variables: { input: { title: "Never created" } },
      }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    } satisfies Partial<RegisteredGraphqlOperationError>);
  });

  it("preserves trusted resolver input errors", async () => {
    const result = await run("catalog.course.v1", {
      variables: { jwId: 0 },
    });

    expect(result).toMatchObject({
      success: false,
      errors: [
        {
          message: "jwId must be a positive integer.",
          extensions: { code: "BAD_USER_INPUT" },
        },
      ],
    });
  });

  it("masks unexpected resolver failures", async () => {
    catalogService.getCurrentSemester.mockRejectedValue(
      new Error("private-current-semester-failure"),
    );

    const result = await run("catalog.current_semester.v1");

    expect(result).toMatchObject({
      success: false,
      operationId: "catalog.current_semester.v1",
      errors: [{ message: "Unexpected error." }],
    });
    expect(JSON.stringify(result)).not.toContain(
      "private-current-semester-failure",
    );
  });
});
