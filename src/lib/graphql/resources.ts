import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lexicographicSortSchema, printSchema } from "graphql";
import {
  GRAPHQL_OPERATIONS_RESOURCE_URI,
  GRAPHQL_SCHEMA_RESOURCE_URI,
} from "./constants";
import operationsManifest from "./operations.json" with { type: "json" };
import { graphqlSchema } from "./schema";

export const graphqlSchemaSdl = `${printSchema(
  lexicographicSortSchema(graphqlSchema),
)}\n`;

export const graphqlOperationsManifest = `${JSON.stringify(
  operationsManifest,
  null,
  2,
)}\n`;

export function registerGraphqlResources(server: McpServer) {
  server.registerResource(
    "graphql_schema_sdl",
    GRAPHQL_SCHEMA_RESOURCE_URI,
    {
      title: "Life@USTC GraphQL schema",
      description: "Canonical public GraphQL SDL.",
      mimeType: "text/plain",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: graphqlSchemaSdl,
        },
      ],
    }),
  );

  server.registerResource(
    "graphql_operations_manifest",
    GRAPHQL_OPERATIONS_RESOURCE_URI,
    {
      title: "Life@USTC GraphQL operations manifest",
      description:
        "Persisted-operation manifest; intentionally empty in Phase 1.",
      mimeType: "application/json",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: graphqlOperationsManifest,
        },
      ],
    }),
  );
}
