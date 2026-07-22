import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import { runGraphqlDocument } from "@/lib/graphql/document-runner";
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
    "Optional approved operation ID from life-ustc://graphql/operations. Use either operationId or document.",
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
      title: "Run GraphQL Operation",
      description:
        "Runs either an arbitrary GraphQL document or one compatible registered operation. " +
        "Field resolvers enforce exact OAuth scopes; every mutation requires confirmation.",
      inputSchema: {
        operationId: operationIdSchema.optional(),
        document: z
          .string()
          .min(1)
          .max(GRAPHQL_LIMITS.bodyBytes)
          .optional()
          .describe(
            "Arbitrary GraphQL query or mutation document. Use either document or operationId.",
          ),
        operationName: z
          .string()
          .regex(/^[_A-Za-z][_0-9A-Za-z]*$/)
          .max(80)
          .optional()
          .describe("Operation to select when document defines more than one."),
        variables: z
          .record(z.string(), z.unknown())
          .default({})
          .describe(
            "Variables for the selected document or registered operation.",
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
        title: "Run GraphQL Operation",
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
    async (
      { operationId, document, operationName, variables, confirmed, locale },
      extra,
    ) => {
      const operationLabel = operationId ?? "document";
      if (!extra.authInfo) {
        return errorToolResult(
          {
            success: false,
            operationId: operationLabel,
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
        if ((operationId == null) === (document == null)) {
          throw new RegisteredGraphqlOperationError(
            "BAD_USER_INPUT",
            "Provide exactly one of operationId or document.",
          );
        }
        const principal = {
          kind: "oauth" as const,
          userId: getUserId(extra.authInfo),
          scopes: expandScopeClaim(extra.authInfo.scopes),
          resource: extra.authInfo.resource?.href ?? getOAuthMcpResourceUrl(),
          ...(extra.authInfo.clientId
            ? { clientId: extra.authInfo.clientId }
            : {}),
        };
        const requestInfo = {
          headers: extra.requestInfo?.headers,
          requestId: String(extra.requestId),
          url: extra.requestInfo?.url,
        };
        const result = operationId
          ? await runRegisteredGraphqlOperation({
              operationId,
              variables,
              confirmed,
              locale,
              principal,
              signal: extra.signal,
              requestInfo,
            })
          : await runGraphqlDocument({
              document: document as string,
              operationName,
              variables,
              confirmed,
              locale,
              principal,
              signal: extra.signal,
              requestInfo,
            });
        const toolResult = jsonToolResult(result, { mode: "full" });
        if (result.success) return toolResult;
        const requiredScopes = result.errors?.flatMap((error) => {
          const value = error.extensions?.requiredScopes;
          return Array.isArray(value)
            ? value.filter(
                (scope): scope is string => typeof scope === "string",
              )
            : [];
        });
        return {
          ...toolResult,
          isError: true as const,
          ...(requiredScopes?.length
            ? {
                _meta: {
                  "mcp/www_authenticate": [
                    buildBearerChallenge({
                      error: INSUFFICIENT_SCOPE_ERROR,
                      description:
                        "Additional OAuth scope is required for this GraphQL operation.",
                      scopes: [...new Set(requiredScopes)],
                    }),
                  ],
                },
              }
            : {}),
        };
      } catch (error) {
        if (error instanceof RegisteredGraphqlOperationError) {
          return errorToolResult(
            {
              success: false,
              operationId: operationLabel,
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
          operationId: operationLabel,
          error: "INTERNAL_SERVER_ERROR",
          message: "Unexpected error.",
        });
      }
    },
  );
}
