import { execute as executeGraphql } from "@graphql-tools/executor";
import {
  GraphQLError,
  type GraphQLFormattedError,
  getOperationAST,
  getVariableValues,
} from "graphql";
import type { AppLocale } from "@/i18n/config";
import type { RestFeature } from "@/lib/oauth/constants";
import { hasRequiredFeatureScope } from "@/lib/oauth/scope-registry";
import type { GraphqlPrincipal } from "./auth";
import { GRAPHQL_LIMITS } from "./constants";
import type { GraphqlContext } from "./context";
import { formatMaskedGraphqlError } from "./error-masking";
import { createGraphqlLoaders } from "./loaders";
import { recordGraphqlOperationObservation } from "./observability";
import {
  analyzeGraphqlOperation,
  type GraphqlOperationAnalysis,
} from "./operation-analysis";
import {
  graphqlOperationValidationSchema,
  graphqlPersistedOperationById,
  type RegisteredPersistedGraphqlOperation,
} from "./operations";
import { createDeadline } from "./request-deadline";
import { graphqlSchema } from "./schema";

export type RegisteredGraphqlOperationErrorCode =
  | "BAD_USER_INPUT"
  | "CONFIRMATION_REQUIRED"
  | "FORBIDDEN"
  | "REQUEST_CANCELLED"
  | "REQUEST_TIMEOUT"
  | "UNKNOWN_OPERATION";

export class RegisteredGraphqlOperationError extends Error {
  constructor(
    readonly code: RegisteredGraphqlOperationErrorCode,
    message: string,
    readonly requiredScopes: readonly string[] = [],
  ) {
    super(message);
    this.name = "RegisteredGraphqlOperationError";
  }
}

export type RegisteredGraphqlOperationResult = {
  data?: Record<string, unknown> | null;
  errors?: readonly GraphQLFormattedError[];
  operationId: string;
  operationName: string;
  operationType: "mutation" | "query";
  success: boolean;
};

export type RegisteredGraphqlOperationRequestInfo = {
  headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
  requestId?: string | null;
  url?: URL | string;
};

function requireVariablesRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      "variables must be an object.",
    );
  }
  return value as Record<string, unknown>;
}

function serializedVariableBytes(variables: Record<string, unknown>) {
  try {
    return new TextEncoder().encode(JSON.stringify(variables)).byteLength;
  } catch {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      "variables must be JSON-serializable.",
    );
  }
}

function validateVariables(
  operation: RegisteredPersistedGraphqlOperation,
  value: unknown,
) {
  const variables = requireVariablesRecord(value);
  if (serializedVariableBytes(variables) > GRAPHQL_LIMITS.bodyBytes) {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      `variables must not exceed ${GRAPHQL_LIMITS.bodyBytes} bytes.`,
    );
  }

  const allowedNames = new Set(
    operation.variables.map((variable) => variable.name),
  );
  const extraNames = Object.keys(variables)
    .filter((name) => !allowedNames.has(name))
    .sort();
  if (extraNames.length > 0) {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      `Unknown variable${extraNames.length === 1 ? "" : "s"}: ${extraNames.join(
        ", ",
      )}.`,
    );
  }

  const operationAst = getOperationAST(
    operation.document,
    operation.operationName,
  );
  if (!operationAst) {
    throw new Error(`Registered GraphQL operation ${operation.id} is invalid`);
  }
  const coerced = getVariableValues(
    graphqlOperationValidationSchema,
    operationAst.variableDefinitions ?? [],
    variables,
    { maxErrors: 10 },
  );
  if (coerced.errors) {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      coerced.errors.map((error) => error.message).join(" "),
    );
  }

  return coerced.coerced;
}

function requiredScopeRequirement(scope: string) {
  const [feature, action] = scope.split(":");
  return {
    feature: feature as RestFeature,
    action: action as "read" | "write",
  };
}

function requireOperationScopes(
  operation: RegisteredPersistedGraphqlOperation,
  principal: GraphqlPrincipal,
) {
  if (operation.scopes.length === 0) return;
  if (principal.kind === "anonymous") {
    throw new RegisteredGraphqlOperationError(
      "FORBIDDEN",
      "Authentication is required for this operation.",
      operation.scopes,
    );
  }
  if (principal.kind === "session") return;

  const missing = operation.scopes.filter(
    (scope) =>
      !hasRequiredFeatureScope(
        principal.scopes,
        requiredScopeRequirement(scope),
      ),
  );
  if (missing.length > 0) {
    throw new RegisteredGraphqlOperationError(
      "FORBIDDEN",
      "Insufficient OAuth scope.",
      missing,
    );
  }
}

function headerValue(
  headers:
    | Readonly<Record<string, string | readonly string[] | undefined>>
    | undefined,
  name: string,
) {
  const entry = Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === name,
  );
  const value = entry?.[1];
  if (Array.isArray(value)) return value.join(", ").slice(0, 512);
  return typeof value === "string" ? value.slice(0, 512) : undefined;
}

function safeRequestHeaders(
  requestInfo: RegisteredGraphqlOperationRequestInfo | undefined,
) {
  const headers = new Headers();
  for (const name of [
    "user-agent",
    "x-forwarded-for",
    "x-real-ip",
    "x-request-id",
  ]) {
    const value =
      name === "x-request-id"
        ? (requestInfo?.requestId ?? headerValue(requestInfo?.headers, name))
        : headerValue(requestInfo?.headers, name);
    if (value) headers.set(name, value.slice(0, 512));
  }
  return headers;
}

function safeRequestUrl(value: URL | string | undefined) {
  try {
    const url = new URL(value?.toString() ?? "http://mcp.local/api/mcp");
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : new URL("http://mcp.local/api/mcp");
  } catch {
    return new URL("http://mcp.local/api/mcp");
  }
}

function operationResult(
  operation: RegisteredPersistedGraphqlOperation,
  input: {
    data?: Record<string, unknown> | null;
    errors?: readonly GraphQLFormattedError[];
  },
): RegisteredGraphqlOperationResult {
  return {
    operationId: operation.id,
    operationName: operation.operationName,
    operationType: operation.operationType,
    success: !input.errors?.length,
    ...(input.data !== undefined ? { data: input.data } : {}),
    ...(input.errors?.length ? { errors: input.errors } : {}),
  };
}

function waitForExecutionOrAbort<T>(
  execution: T | PromiseLike<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });

    Promise.resolve(execution).then(
      (result) => {
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );

    if (signal.aborted) onAbort();
  });
}

function errorAnalysis(
  operation: RegisteredPersistedGraphqlOperation,
): GraphqlOperationAnalysis {
  return analyzeGraphqlOperation({
    document: operation.document,
    operationName: operation.operationName,
    variables: {},
  });
}

export async function runRegisteredGraphqlOperation(input: {
  confirmed?: boolean;
  locale: AppLocale;
  operationId: string;
  principal: GraphqlPrincipal;
  requestInfo?: RegisteredGraphqlOperationRequestInfo;
  signal: AbortSignal;
  variables?: unknown;
}): Promise<RegisteredGraphqlOperationResult> {
  const operation = graphqlPersistedOperationById.get(input.operationId);
  if (!operation) {
    throw new RegisteredGraphqlOperationError(
      "UNKNOWN_OPERATION",
      `Unknown registered GraphQL operation "${input.operationId}".`,
    );
  }

  const startedAt = Date.now();
  let analysis = errorAnalysis(operation);
  let errorCount = 0;
  const deadline = createDeadline(input.signal, GRAPHQL_LIMITS.timeoutMs);

  try {
    requireOperationScopes(operation, input.principal);
    if (operation.requiresConfirmation && input.confirmed !== true) {
      throw new RegisteredGraphqlOperationError(
        "CONFIRMATION_REQUIRED",
        `Operation "${operation.id}" requires explicit confirmation.`,
      );
    }
    const variables = validateVariables(operation, input.variables ?? {});
    analysis = analyzeGraphqlOperation({
      document: operation.document,
      operationName: operation.operationName,
      variables,
    });
    if (analysis.estimatedCost > GRAPHQL_LIMITS.cost) {
      throw new RegisteredGraphqlOperationError(
        "BAD_USER_INPUT",
        "Query cost limit exceeded.",
      );
    }

    const request = new Request(safeRequestUrl(input.requestInfo?.url), {
      method: "POST",
      headers: safeRequestHeaders(input.requestInfo),
      signal: deadline.signal,
    });
    const context: GraphqlContext = {
      loaders: createGraphqlLoaders(input.locale),
      locale: input.locale,
      principal: input.principal,
      request,
    };
    const result = await waitForExecutionOrAbort(
      executeGraphql({
        schema: graphqlSchema,
        document: operation.document,
        contextValue: context,
        operationName: operation.operationName,
        variableValues: variables,
        signal: deadline.signal,
      }),
      deadline.signal,
    );
    if ("initialResult" in result) {
      throw new Error("Incremental registered GraphQL operations are disabled");
    }

    const errors = result.errors?.map(formatMaskedGraphqlError);
    errorCount = errors?.length ?? 0;
    return operationResult(operation, {
      data: result.data as Record<string, unknown> | null | undefined,
      errors,
    });
  } catch (error) {
    errorCount = 1;
    if (error instanceof RegisteredGraphqlOperationError) throw error;
    if (deadline.timedOut()) {
      throw new RegisteredGraphqlOperationError(
        "REQUEST_TIMEOUT",
        "Registered GraphQL operation timed out.",
      );
    }
    if (input.signal.aborted) {
      throw new RegisteredGraphqlOperationError(
        "REQUEST_CANCELLED",
        "Registered GraphQL operation was cancelled.",
      );
    }

    const originalError =
      error instanceof Error ? error : new Error("Unknown execution failure");
    const formatted = formatMaskedGraphqlError(
      new GraphQLError(originalError.message, { originalError }),
    );
    return operationResult(operation, { errors: [formatted] });
  } finally {
    deadline.cleanup();
    recordGraphqlOperationObservation({
      ...analysis,
      authMode: input.principal.kind,
      durationMs: Date.now() - startedAt,
      errorCount,
      requestId: input.requestInfo?.requestId,
    });
  }
}
