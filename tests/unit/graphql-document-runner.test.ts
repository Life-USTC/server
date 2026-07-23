import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

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

import type { GraphqlPrincipal } from "@/lib/graphql/auth";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import { runGraphqlDocument } from "@/lib/graphql/document-runner";
import type { RegisteredGraphqlOperationError } from "@/lib/graphql/operation-runner";

const sessionPrincipal: GraphqlPrincipal = {
  kind: "session",
  userId: "document-runner-user",
};

function run(
  document: string,
  input: {
    confirmed?: boolean;
    principal?: GraphqlPrincipal;
    signal?: AbortSignal;
    variables?: Record<string, unknown>;
  } = {},
) {
  return runGraphqlDocument({
    confirmed: input.confirmed,
    document,
    locale: "zh-cn",
    principal: input.principal ?? sessionPrincipal,
    requestInfo: {
      requestId: "graphql-document-runner-test",
      url: "https://example.test/api/mcp",
    },
    signal: input.signal ?? new AbortController().signal,
    variables: input.variables,
  });
}

function installAnalytics() {
  const writeDataPoint = vi.fn();
  setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
  return writeDataPoint;
}

describe("arbitrary GraphQL document runner", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    catalogService.getCurrentSemester.mockResolvedValue({
      id: 1,
      jwId: 202601,
      code: "2026SP",
      nameCn: "2026 春",
      startDate: new Date("2026-02-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    catalogService.getCurrentSemester.mockReset();
    vi.restoreAllMocks();
  });

  it("enforces UTF-8 document and serialized body budgets on direct calls", async () => {
    const writeDataPoint = installAnalytics();
    const oversizedDocument = "课".repeat(
      Math.floor(GRAPHQL_LIMITS.bodyBytes / 3) + 1,
    );

    await expect(run(oversizedDocument)).rejects.toMatchObject({
      code: "BAD_USER_INPUT",
      message: `GraphQL document must not exceed ${GRAPHQL_LIMITS.bodyBytes} bytes.`,
    } satisfies Partial<RegisteredGraphqlOperationError>);
    await expect(
      run("query BodyBudget { catalog { currentSemester { jwId } } }", {
        variables: { value: "x".repeat(GRAPHQL_LIMITS.bodyBytes) },
      }),
    ).rejects.toMatchObject({
      code: "BAD_USER_INPUT",
      message: `GraphQL request must not exceed ${GRAPHQL_LIMITS.bodyBytes} bytes.`,
    } satisfies Partial<RegisteredGraphqlOperationError>);

    expect(writeDataPoint).toHaveBeenCalledTimes(2);
  });

  it("rejects a pre-aborted call and records it once", async () => {
    const writeDataPoint = installAnalytics();
    const controller = new AbortController();
    controller.abort(new DOMException("Caller cancelled", "AbortError"));

    await expect(
      run("query NeverParsed { catalog { currentSemester { jwId } } }", {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "REQUEST_CANCELLED",
    } satisfies Partial<RegisteredGraphqlOperationError>);

    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        indexes: ["graphql:unknown"],
        doubles: [expect.any(Number), 0, 0, 1, 0],
      }),
    );
  });

  it("includes synchronous preflight work in the deadline", async () => {
    const writeDataPoint = installAnalytics();
    let clockReads = 0;
    vi.spyOn(Date, "now").mockImplementation(() =>
      clockReads++ < 2 ? 0 : GRAPHQL_LIMITS.timeoutMs,
    );

    await expect(
      run("query NeverParsed { catalog { currentSemester { jwId } } }"),
    ).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    } satisfies Partial<RegisteredGraphqlOperationError>);

    expect(writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it("records parse, confirmation, and scope preflight failures", async () => {
    const writeDataPoint = installAnalytics();
    const mutation = /* GraphQL */ `
      mutation CreateTodo($title: String!) {
        todoCreate(input: { title: $title }) {
          id
        }
      }
    `;

    await expect(run("query Broken { currentSemester(")).rejects.toMatchObject({
      code: "BAD_USER_INPUT",
    } satisfies Partial<RegisteredGraphqlOperationError>);
    await expect(
      run(mutation, { variables: { title: "confirmation" } }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    } satisfies Partial<RegisteredGraphqlOperationError>);
    await expect(
      run(mutation, {
        confirmed: true,
        principal: {
          kind: "oauth",
          userId: "document-runner-user",
          resource: "https://example.test/api/mcp",
          scopes: new Set(),
        },
        variables: { title: "scope" },
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      requiredScopes: ["todo:write"],
    } satisfies Partial<RegisteredGraphqlOperationError>);

    expect(writeDataPoint).toHaveBeenCalledTimes(3);
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        indexes: ["graphql:unknown"],
        doubles: [expect.any(Number), 0, 0, 1, 0],
      }),
    );
    for (const call of [2, 3]) {
      expect(writeDataPoint).toHaveBeenNthCalledWith(
        call,
        expect.objectContaining({
          indexes: ["graphql:mutation"],
          blobs: expect.arrayContaining(["CreateTodo", "mutation"]),
          doubles: [expect.any(Number), 1, 3, 1, 0],
        }),
      );
    }
  });

  it("records a successful Yoga execution exactly once", async () => {
    const writeDataPoint = installAnalytics();

    await expect(
      run("query CurrentSemester { catalog { currentSemester { jwId } } }"),
    ).resolves.toMatchObject({
      success: true,
      operationName: "CurrentSemester",
      operationType: "query",
      data: { catalog: { currentSemester: { jwId: 202601 } } },
    });

    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["graphql:query"],
      blobs: [
        "graphql_operation_v2",
        "CurrentSemester",
        "query",
        "session",
        "graphql-document-runner-test",
      ],
      doubles: [expect.any(Number), 1, 5, 0, 0],
    });
  });
});
