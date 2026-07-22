import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GRAPHQL_OPERATIONS_RESOURCE_URI,
  GRAPHQL_SCHEMA_RESOURCE_URI,
} from "./constants";
import { graphqlOperationsManifest, graphqlSchemaSdl } from "./resources";

export const GRAPHQL_OPERATION_PROMPT_NAME = "plan_graphql_operation";

export function registerGraphqlPrompts(server: McpServer) {
  server.registerPrompt(
    GRAPHQL_OPERATION_PROMPT_NAME,
    {
      title: "Plan a Life@USTC GraphQL operation",
      description:
        "Injects the canonical GraphQL schema and safe operation manifest, then guides a scoped run_graphql_operation call.",
      argsSchema: {
        goal: z
          .string()
          .min(1)
          .max(1_000)
          .describe("The user-visible result or change to accomplish."),
        operationType: z
          .enum(["query", "mutation"])
          .optional()
          .describe("Optional operation type when it is already known."),
      },
    },
    ({ goal, operationType }) => ({
      description: "Plan one safe, bounded Life@USTC GraphQL tool call.",
      messages: [
        {
          role: "user",
          content: {
            type: "resource",
            resource: {
              uri: GRAPHQL_SCHEMA_RESOURCE_URI,
              mimeType: "text/plain",
              text: graphqlSchemaSdl,
            },
          },
        },
        {
          role: "user",
          content: {
            type: "resource",
            resource: {
              uri: GRAPHQL_OPERATIONS_RESOURCE_URI,
              mimeType: "application/json",
              text: graphqlOperationsManifest,
            },
          },
        },
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Goal: ${goal}`,
              operationType ? `Operation type: ${operationType}.` : null,
              "Use run_graphql_operation exactly once when one bounded operation can satisfy the goal.",
              "Prefer a registered operationId only when its manifest entry exactly fits; otherwise compose one named document from the embedded canonical schema.",
              "If a document contains multiple operations, pass operationName to select exactly one.",
              "Select only required fields, provide variables separately, and use explicit bounded pagination.",
              "Treat resolver scopes as authoritative. If the tool returns an insufficient_scope challenge, request only the listed scopes before retrying.",
              "For a mutation, first summarize the exact change and obtain user confirmation; only then pass confirmed=true.",
              "After REQUEST_TIMEOUT or REQUEST_CANCELLED on a mutation, inspect current state instead of blindly retrying.",
              "A failed GraphQL result can contain both errors and partial data; preserve both when explaining the outcome.",
              "Do not use introspection or place credentials, cookies, or bearer tokens in the document or variables.",
            ]
              .filter((line): line is string => line !== null)
              .join("\n"),
          },
        },
      ],
    }),
  );
}
