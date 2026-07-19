import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildSchema, lexicographicSortSchema, printSchema } from "graphql";
import {
  GRAPHQL_OPERATIONS_RESOURCE_URI,
  GRAPHQL_SCHEMA_RESOURCE_URI,
} from "./constants";
import { publicGraphqlOperationsManifest } from "./operations";
import { graphqlTypeDefs } from "./schema";

export const graphqlSchemaSdl = `${printSchema(
  lexicographicSortSchema(buildSchema(graphqlTypeDefs)),
)}\n`;

export const graphqlOperationsManifest = `${JSON.stringify(
  publicGraphqlOperationsManifest,
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
        "Versioned registered GraphQL operation metadata and safety capabilities. Operation documents are never exposed.",
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
