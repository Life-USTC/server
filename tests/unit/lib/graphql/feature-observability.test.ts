import {
  GraphQLBoolean,
  GraphQLError,
  type GraphQLFieldResolver,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLString,
  graphql,
} from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRequestContext,
} from "@/lib/adapters/cloudflare-runtime";
import { runWithObservability } from "@/lib/db/observability-context";
import type { GraphqlPrincipal } from "@/lib/graphql/auth";
import {
  GRAPHQL_FEATURE_RESOLVER_MAPPINGS,
  observeGraphqlResolverMap,
} from "@/lib/graphql/feature-observability";

const { writeObservabilityBatchMock } = vi.hoisted(() => ({
  writeObservabilityBatchMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db/feature-event-store", () => ({
  writeObservabilityBatch: writeObservabilityBatchMock,
}));

type TestContext = { principal: GraphqlPrincipal };

const requestId = "123e4567-e89b-12d3-a456-426614174000";

const courseFilter = new GraphQLInputObjectType({
  name: "CourseFilter",
  fields: { search: { type: GraphQLString } },
});

const catalogResolvers = observeGraphqlResolverMap(
  {
    courses: (
      _parent: unknown,
      args: { filter?: { search?: string | null } | null },
    ) => (args.filter?.search ? "searched courses" : "listed courses"),
    course: (
      _parent: unknown,
      _args: unknown,
      _context: TestContext,
      info: GraphQLResolveInfo,
    ) => {
      if (info.path.key === "broken") {
        throw new GraphQLError("invalid course input", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (info.path.key === "missing") return null;
      return "course";
    },
  },
  GRAPHQL_FEATURE_RESOLVER_MAPPINGS.Catalog,
);

const workspaceResolvers = observeGraphqlResolverMap(
  { overview: () => "overview" },
  GRAPHQL_FEATURE_RESOLVER_MAPPINGS.Workspace,
);

const batchErrorType = new GraphQLObjectType({
  name: "BatchError",
  fields: {
    code: { type: GraphQLString },
    message: { type: GraphQLString },
  },
});

const batchResultType = new GraphQLObjectType({
  name: "BatchResult",
  fields: {
    completed: { type: GraphQLBoolean },
    error: { type: batchErrorType },
    homeworkId: { type: GraphQLString },
    success: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const batchPayloadType = new GraphQLObjectType({
  name: "BatchPayload",
  fields: {
    results: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(batchResultType)),
      ),
    },
  },
});

const mutationResolvers = observeGraphqlResolverMap(
  {
    homeworkCompletionsSet: () => ({
      results: [
        { completed: true, homeworkId: "known", success: true, error: null },
        {
          completed: true,
          error: { code: "not_found", message: "Homework not found" },
          homeworkId: "missing",
          success: false,
        },
      ],
    }),
  },
  GRAPHQL_FEATURE_RESOLVER_MAPPINGS.Mutation,
);

const catalogType = new GraphQLObjectType({
  name: "Catalog",
  fields: {
    course: {
      args: { jwId: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: catalogResolvers.course as GraphQLFieldResolver<
        unknown,
        TestContext
      >,
      type: GraphQLString,
    },
    courses: {
      args: { filter: { type: courseFilter } },
      resolve: catalogResolvers.courses as GraphQLFieldResolver<
        unknown,
        TestContext
      >,
      type: GraphQLString,
    },
  },
});

const workspaceType = new GraphQLObjectType({
  name: "Workspace",
  fields: {
    overview: {
      resolve: workspaceResolvers.overview as GraphQLFieldResolver<
        unknown,
        TestContext
      >,
      type: GraphQLString,
    },
  },
});

const queryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    catalog: { resolve: () => ({}), type: catalogType },
    workspace: { resolve: () => ({}), type: workspaceType },
  },
});

const mutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: {
    homeworkCompletionsSet: {
      resolve: mutationResolvers.homeworkCompletionsSet as GraphQLFieldResolver<
        unknown,
        TestContext
      >,
      type: batchPayloadType,
    },
  },
});

const schema = new GraphQLSchema({ mutation: mutationType, query: queryType });

function featureEvents() {
  return writeObservabilityBatchMock.mock.calls.flatMap(
    ([batch]) => batch.features ?? [],
  );
}

function featureTuples() {
  return featureEvents().map((event) => [
    event.feature,
    event.operation,
    event.protocol,
    event.surface,
    event.authMode,
    event.outcome,
    event.errorClass,
  ]);
}

async function flushObservability() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function execute(
  source: string,
  principal: GraphqlPrincipal = { kind: "anonymous" },
) {
  const result = await runWithCloudflareRuntimeEnv({}, async () => {
    setCloudflareRequestContext({
      method: "POST",
      requestId,
      route: "/api/graphql",
    });
    return runWithObservability(() =>
      graphql({
        contextValue: { principal },
        schema,
        source,
      }),
    );
  });
  await flushObservability();
  return {
    features: featureEvents(),
    result,
  };
}

beforeEach(() => {
  writeObservabilityBatchMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GraphQL feature operation observability", () => {
  it("records aliases independently and derives anonymous catalog search", async () => {
    const { features, result } = await execute(/* GraphQL */ `
      {
        catalog {
          listed: courses
          searched: courses(filter: { search: "math" })
        }
      }
    `);

    expect(result).toEqual({
      data: {
        catalog: {
          listed: "listed courses",
          searched: "searched courses",
        },
      },
    });
    expect(features).toHaveLength(2);
    expect(
      features.map((event) => ({
        ...event,
        id: expect.any(String),
        occurredAt: expect.any(Date),
        durationMs: expect.any(Number),
      })),
    ).toEqual([
      expect.objectContaining({
        feature: "catalog.course",
        operation: "list",
        protocol: "graphql",
        surface: "unknown",
        authMode: "anonymous",
        outcome: "success",
        errorClass: "none",
        requestId,
        userId: null,
      }),
      expect.objectContaining({
        feature: "catalog.course",
        operation: "search",
        protocol: "graphql",
        surface: "unknown",
        authMode: "anonymous",
        outcome: "success",
        errorClass: "none",
        requestId,
        userId: null,
      }),
    ]);
  });

  it("rethrows one resolver error while preserving an independent sibling", async () => {
    const { features, result } = await execute(/* GraphQL */ `
      {
        catalog {
          broken: course(jwId: 1)
          good: course(jwId: 2)
        }
      }
    `);

    expect(result.data).toEqual({ catalog: { broken: null, good: "course" } });
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]).toMatchObject({
      message: "invalid course input",
      path: ["catalog", "broken"],
    });
    expect(featureTuples()).toEqual([
      [
        "catalog.course",
        "get",
        "graphql",
        "unknown",
        "anonymous",
        "rejected",
        "invalid_input",
      ],
      [
        "catalog.course",
        "get",
        "graphql",
        "unknown",
        "anonymous",
        "success",
        "none",
      ],
    ]);
    expect(features.every((event) => event.requestId === requestId)).toBe(true);
  });

  it("marks a verified MCP OAuth principal and does not instrument introspection", async () => {
    const principal: GraphqlPrincipal = {
      channel: "mcp",
      clientId: "client",
      kind: "oauth",
      resource: "https://example.test/api/graphql",
      scopes: new Set(),
      userId: "user",
    };
    const mcp = await execute("{ workspace { overview } }", principal);
    expect(mcp.result).toEqual({
      data: { workspace: { overview: "overview" } },
    });
    expect(mcp.features).toHaveLength(1);
    expect(mcp.features[0]).toMatchObject({
      feature: "workspace.overview",
      operation: "get",
      protocol: "graphql",
      surface: "mcp",
      authMode: "oauth",
      outcome: "success",
      errorClass: "none",
      requestId,
      userId: "user",
    });

    writeObservabilityBatchMock.mockReset().mockResolvedValue(undefined);
    const introspection = await execute("{ catalog { __typename } }");
    expect(introspection.result).toEqual({
      data: { catalog: { __typename: "Catalog" } },
    });
    expect(introspection.features).toHaveLength(0);
    const mappedFields = Object.values(
      GRAPHQL_FEATURE_RESOLVER_MAPPINGS,
    ).flatMap((fields) => Object.keys(fields));
    expect(mappedFields.some((field) => field.startsWith("__"))).toBe(false);
  });

  it("does not turn a mixed batch payload into a success", async () => {
    const { features, result } = await execute(/* GraphQL */ `
      mutation {
        homeworkCompletionsSet {
          results {
            success
            homeworkId
            error { code message }
          }
        }
      }
    `);

    expect(result).toEqual({
      data: {
        homeworkCompletionsSet: {
          results: [
            { success: true, homeworkId: "known", error: null },
            {
              success: false,
              homeworkId: "missing",
              error: { code: "not_found", message: "Homework not found" },
            },
          ],
        },
      },
    });
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({
      feature: "workspace.homework",
      operation: "batch",
      protocol: "graphql",
      surface: "unknown",
      authMode: "anonymous",
      outcome: "unknown",
      errorClass: "unknown",
      requestId,
      userId: null,
    });
  });
});

it("classifies a missing catalog detail consistently with REST and MCP without changing GraphQL null", async () => {
  const { features, result } = await execute(
    "{ catalog { missing: course(jwId: 999) } }",
  );
  expect(result).toEqual({ data: { catalog: { missing: null } } });
  expect(features[0]).toMatchObject({
    outcome: "rejected",
    errorClass: "not_found",
  });
});
