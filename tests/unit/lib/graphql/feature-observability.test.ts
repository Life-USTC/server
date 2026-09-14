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
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRequestContext,
} from "@/lib/adapters/cloudflare-runtime";
import type { GraphqlPrincipal } from "@/lib/graphql/auth";
import {
  GRAPHQL_FEATURE_RESOLVER_MAPPINGS,
  observeGraphqlResolverMap,
} from "@/lib/graphql/feature-observability";

type TestContext = { principal: GraphqlPrincipal };
type DataPoint = { blobs?: unknown[]; doubles?: number[]; indexes?: unknown[] };

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

function pointBlobs(points: DataPoint[]) {
  return points.map((point) => point.blobs ?? []);
}

async function execute(
  source: string,
  principal: GraphqlPrincipal = { kind: "anonymous" },
) {
  const writeDataPoint = vi.fn<(point: DataPoint) => void>();
  const result = await runWithCloudflareRuntimeEnv(
    { ANALYTICS: { writeDataPoint } },
    async () => {
      setCloudflareRequestContext({
        method: "POST",
        requestId,
        route: "/api/graphql",
      });
      return graphql({
        contextValue: { principal },
        schema,
        source,
      });
    },
  );
  return {
    points: writeDataPoint.mock.calls.map(([point]) => point),
    result,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GraphQL feature operation observability", () => {
  it("records aliases independently and derives anonymous catalog search", async () => {
    const { points, result } = await execute(/* GraphQL */ `
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
    expect(pointBlobs(points)).toEqual([
      [
        "feature_operation_v1",
        "catalog.course",
        "list",
        "graphql",
        "unknown",
        "anonymous",
        "success",
        "none",
        requestId,
      ],
      [
        "feature_operation_v1",
        "catalog.course",
        "search",
        "graphql",
        "unknown",
        "anonymous",
        "success",
        "none",
        requestId,
      ],
    ]);
  });

  it("rethrows one resolver error while preserving an independent sibling", async () => {
    const { points, result } = await execute(/* GraphQL */ `
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
    expect(pointBlobs(points)).toEqual([
      [
        "feature_operation_v1",
        "catalog.course",
        "get",
        "graphql",
        "unknown",
        "anonymous",
        "rejected",
        "invalid_input",
        requestId,
      ],
      [
        "feature_operation_v1",
        "catalog.course",
        "get",
        "graphql",
        "unknown",
        "anonymous",
        "success",
        "none",
        requestId,
      ],
    ]);
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
    expect(pointBlobs(mcp.points)).toEqual([
      [
        "feature_operation_v1",
        "workspace.overview",
        "get",
        "graphql",
        "mcp",
        "oauth",
        "success",
        "none",
        requestId,
      ],
    ]);

    const introspection = await execute("{ catalog { __typename } }");
    expect(introspection.result).toEqual({
      data: { catalog: { __typename: "Catalog" } },
    });
    expect(introspection.points).toHaveLength(0);
    const mappedFields = Object.values(
      GRAPHQL_FEATURE_RESOLVER_MAPPINGS,
    ).flatMap((fields) => Object.keys(fields));
    expect(mappedFields.some((field) => field.startsWith("__"))).toBe(false);
  });

  it("does not turn a mixed batch payload into a success", async () => {
    const { points, result } = await execute(/* GraphQL */ `
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
    expect(pointBlobs(points)).toEqual([
      [
        "feature_operation_v1",
        "workspace.homework",
        "batch",
        "graphql",
        "unknown",
        "anonymous",
        "unknown",
        "unknown",
        requestId,
      ],
    ]);
  });
});
