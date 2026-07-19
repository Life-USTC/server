import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const catalogService = vi.hoisted(() => ({
  getCurrentSemester: vi.fn(),
}));
const todoService = vi.hoisted(() => ({
  createTodo: vi.fn(),
}));
const mutationRateLimit = vi.hoisted(() => ({
  checkUserMutationRateLimit: vi.fn(),
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

vi.mock("@/features/todos/server/todo-service", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/features/todos/server/todo-service")
    >();
  return {
    ...original,
    createTodo: todoService.createTodo,
  };
});

vi.mock("@/lib/security/user-mutation-rate-limit", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/security/user-mutation-rate-limit")
    >();
  return {
    ...original,
    checkUserMutationRateLimit: mutationRateLimit.checkUserMutationRateLimit,
  };
});

import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
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
    signal?: AbortSignal;
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
    signal: input.signal ?? new AbortController().signal,
    variables: input.variables,
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const currentSemester = {
  id: 1,
  jwId: 202601,
  code: "2026SP",
  nameCn: "2026 春",
  startDate: new Date("2026-02-01T00:00:00.000Z"),
  endDate: new Date("2026-06-30T00:00:00.000Z"),
};

describe("registered GraphQL operation runner", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mutationRateLimit.checkUserMutationRateLimit.mockResolvedValue({
      allowed: true,
    });
  });

  afterEach(() => {
    catalogService.getCurrentSemester.mockReset();
    todoService.createTodo.mockReset();
    mutationRateLimit.checkUserMutationRateLimit.mockReset();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("executes a fixed pre-parsed operation without accepting a document", async () => {
    catalogService.getCurrentSemester.mockResolvedValue(currentSemester);

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
    await expect(
      run("upload.create_session.v1", {
        confirmed: true,
        scopes: new Set(["upload:write"]),
        variables: {
          input: {
            filename: "report.pdf",
            contentType: "application/pdf",
            size: 12,
            bytes: "raw-object-data-is-never-accepted",
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "BAD_USER_INPUT",
      message: expect.stringContaining(
        'Field "bytes" is not defined by type "CreateUploadSessionInput"',
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

  it("times out a running query at the runner boundary", async () => {
    vi.useFakeTimers();
    const result = deferred<typeof currentSemester>();
    const started = deferred<void>();
    catalogService.getCurrentSemester.mockImplementation(() => {
      started.resolve(undefined);
      return result.promise;
    });

    const execution = run("catalog.current_semester.v1");
    await started.promise;
    const assertion = expect(execution).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    } satisfies Partial<RegisteredGraphqlOperationError>);

    await vi.advanceTimersByTimeAsync(GRAPHQL_LIMITS.timeoutMs);
    await assertion;
    result.resolve(currentSemester);
    await vi.runAllTimersAsync();
  });

  it("times out a running serial mutation at the runner boundary", async () => {
    vi.useFakeTimers();
    const result = deferred<{ id: string }>();
    const started = deferred<void>();
    todoService.createTodo.mockImplementation(() => {
      started.resolve(undefined);
      return result.promise;
    });

    const execution = run("todo.create.v1", {
      confirmed: true,
      variables: { input: { title: "Slow todo" } },
    });
    await started.promise;
    const assertion = expect(execution).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    } satisfies Partial<RegisteredGraphqlOperationError>);

    await vi.advanceTimersByTimeAsync(GRAPHQL_LIMITS.timeoutMs);
    await assertion;
    result.resolve({ id: "late-todo" });
    await vi.runAllTimersAsync();
  });

  it("cancels a running query at the runner boundary", async () => {
    const result = deferred<typeof currentSemester>();
    const started = deferred<void>();
    const controller = new AbortController();
    catalogService.getCurrentSemester.mockImplementation(() => {
      started.resolve(undefined);
      return result.promise;
    });

    const execution = run("catalog.current_semester.v1", {
      signal: controller.signal,
    });
    await started.promise;
    controller.abort(new DOMException("Caller cancelled", "AbortError"));

    await expect(execution).rejects.toMatchObject({
      code: "REQUEST_CANCELLED",
    } satisfies Partial<RegisteredGraphqlOperationError>);
    result.resolve(currentSemester);
  });

  it("cancels a running serial mutation at the runner boundary", async () => {
    const result = deferred<{ id: string }>();
    const started = deferred<void>();
    const controller = new AbortController();
    todoService.createTodo.mockImplementation(() => {
      started.resolve(undefined);
      return result.promise;
    });

    const execution = run("todo.create.v1", {
      confirmed: true,
      signal: controller.signal,
      variables: { input: { title: "Cancelled todo" } },
    });
    await started.promise;
    controller.abort(new DOMException("Caller cancelled", "AbortError"));

    await expect(execution).rejects.toMatchObject({
      code: "REQUEST_CANCELLED",
    } satisfies Partial<RegisteredGraphqlOperationError>);
    result.resolve({ id: "cancelled-todo" });
  });
});
