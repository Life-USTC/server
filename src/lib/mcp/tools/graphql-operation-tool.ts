import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  RegisteredGraphqlOperationError,
  runRegisteredGraphqlOperation,
} from "@/lib/graphql/operation-runner";
import {
  graphqlPersistedOperationRegistry,
  publicGraphqlOperationsManifest,
} from "@/lib/graphql/operations";
import {
  buildBearerChallenge,
  INSUFFICIENT_SCOPE_ERROR,
  INVALID_TOKEN_ERROR,
} from "@/lib/mcp/auth-errors";
import { getUserId, jsonToolResult } from "@/lib/mcp/tools/_helpers";
import { getOAuthMcpResourceUrl } from "@/lib/oauth/resource-urls";
import { expandScopeClaim } from "@/lib/oauth/scope-registry";
import { mcpLocaleInputSchema } from "./helper-schemas";

const operationIds = graphqlPersistedOperationRegistry.map(
  (operation) => operation.id,
);
if (operationIds.length === 0) {
  throw new Error("Registered GraphQL operation runner requires operations");
}

const operationIdSchema = z
  .enum(operationIds as [string, ...string[]])
  .describe(
    "Approved operation ID from life-ustc://graphql/operations. Arbitrary GraphQL documents are not accepted.",
  );

const graphqlRunnerSecuritySchemes = [{ type: "oauth2", scopes: [] }] as const;

function errorToolResult(
  value: unknown,
  challenge?: { error: string; description: string; scopes?: string[] },
) {
  return {
    ...jsonToolResult(value, { mode: "full" }),
    isError: true,
    ...(challenge
      ? {
          _meta: {
            "mcp/www_authenticate": [buildBearerChallenge(challenge)],
          },
        }
      : {}),
  };
}

export function registerGraphqlOperationTool(server: McpServer) {
  server.registerTool(
    "run_graphql_operation",
    {
      title: "Run Approved GraphQL Operation",
      description:
        "Runs one fixed, versioned GraphQL operation from life-ustc://graphql/operations. " +
        "Read the manifest for variables, exact scopes, confirmation, and safety metadata. " +
        "This tool never accepts arbitrary GraphQL documents.",
      inputSchema: {
        operationId: operationIdSchema,
        variables: z
          .record(z.string(), z.unknown())
          .default({})
          .describe(
            "Variables declared by the selected registered operation. Extra variable names are rejected.",
          ),
        confirmed: z
          .boolean()
          .optional()
          .describe(
            "Must be true for every mutation after the user confirms the described change.",
          ),
        locale: mcpLocaleInputSchema,
      },
      annotations: {
        title: "Run Approved GraphQL Operation",
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
      _meta: {
        securitySchemes: graphqlRunnerSecuritySchemes,
        "life-ustc/graphqlOperationsManifest":
          publicGraphqlOperationsManifest.schemaVersion,
      },
    },
    async ({ operationId, variables, confirmed, locale }, extra) => {
      if (!extra.authInfo) {
        return errorToolResult(
          {
            success: false,
            operationId,
            error: "UNAUTHENTICATED",
            message: "Authenticated MCP user context is required.",
          },
          {
            error: INVALID_TOKEN_ERROR,
            description: "Authenticated MCP user context is required.",
          },
        );
      }

      try {
        const result = await runRegisteredGraphqlOperation({
          operationId,
          variables,
          confirmed,
          locale,
          principal: {
            kind: "oauth",
            userId: getUserId(extra.authInfo),
            scopes: expandScopeClaim(extra.authInfo.scopes),
            resource: extra.authInfo.resource?.href ?? getOAuthMcpResourceUrl(),
            ...(extra.authInfo.clientId
              ? { clientId: extra.authInfo.clientId }
              : {}),
          },
          signal: extra.signal,
          requestInfo: {
            headers: extra.requestInfo?.headers,
            requestId: String(extra.requestId),
            url: extra.requestInfo?.url,
          },
        });
        const toolResult = jsonToolResult(result, { mode: "full" });
        return result.success
          ? toolResult
          : { ...toolResult, isError: true as const };
      } catch (error) {
        if (error instanceof RegisteredGraphqlOperationError) {
          return errorToolResult(
            {
              success: false,
              operationId,
              error: error.code,
              message: error.message,
              ...(error.requiredScopes.length > 0
                ? { requiredScopes: error.requiredScopes }
                : {}),
            },
            error.code === "FORBIDDEN" && error.requiredScopes.length > 0
              ? {
                  error: INSUFFICIENT_SCOPE_ERROR,
                  description:
                    "Additional OAuth scope is required for this GraphQL operation.",
                  scopes: [...error.requiredScopes],
                }
              : undefined,
          );
        }
        return errorToolResult({
          success: false,
          operationId,
          error: "INTERNAL_SERVER_ERROR",
          message: "Unexpected error.",
        });
      }
    },
  );
}
