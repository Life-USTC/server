import {
  type DocumentNode,
  type FragmentDefinitionNode,
  GraphQLError,
  type GraphQLFormattedError,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  getDirectiveValues,
  getOperationAST,
  getVariableValues,
  Kind,
  type OperationDefinitionNode,
  parse,
  type SelectionNode,
  type SelectionSetNode,
} from "graphql";
import type { AppLocale } from "@/i18n/config";
import type { RestFeature } from "@/lib/oauth/constants";
import { hasRequiredFeatureScope } from "@/lib/oauth/scope-registry";
import type { GraphqlPrincipal } from "./auth";
import {
  GRAPHQL_ENDPOINT,
  GRAPHQL_LIMITS,
  isWithinGraphqlBodyByteLimit,
} from "./constants";
import { formatMaskedGraphqlError } from "./error-masking";
import { recordGraphqlOperationObservation } from "./observability";
import {
  analyzeGraphqlOperation,
  type GraphqlOperationAnalysis,
} from "./operation-analysis";
import {
  RegisteredGraphqlOperationError,
  type RegisteredGraphqlOperationRequestInfo,
  type RegisteredGraphqlOperationResult,
  safeGraphqlRequestHeaders,
  safeGraphqlRequestUrl,
} from "./operation-runner";
import {
  graphqlOperationValidationSchema,
  graphqlPersistedOperationRegistry,
} from "./operations";
import { createDeadline } from "./request-deadline";
import { createGraphqlYoga } from "./server";

const mcpGraphqlYoga = createGraphqlYoga(true);

const mutationScopes = new Map(
  graphqlPersistedOperationRegistry
    .filter((operation) => operation.operationType === "mutation")
    .map((operation) => [operation.rootField, operation.scopes] as const),
);

const UNKNOWN_ANALYSIS: GraphqlOperationAnalysis = {
  estimatedCost: 0,
  operationName: "unknown",
  operationType: "unknown",
  topLevelFieldCount: 0,
};

type GraphqlResponsePayload = {
  data?: Record<string, unknown> | null;
  errors?: GraphQLFormattedError[];
};

function requestBody(input: {
  document: string;
  operationName?: string;
  variables: Record<string, unknown>;
}) {
  let body: string;
  try {
    body = JSON.stringify({
      query: input.document,
      operationName: input.operationName,
      variables: input.variables,
    });
  } catch {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      "variables must be JSON-serializable.",
    );
  }
  if (!isWithinGraphqlBodyByteLimit(body)) {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      `GraphQL request must not exceed ${GRAPHQL_LIMITS.bodyBytes} bytes.`,
    );
  }
  return body;
}

function requireDocumentByteLimit(document: string) {
  if (!isWithinGraphqlBodyByteLimit(document)) {
    throw new RegisteredGraphqlOperationError(
      "BAD_USER_INPUT",
      `GraphQL document must not exceed ${GRAPHQL_LIMITS.bodyBytes} bytes.`,
    );
  }
}

function requireActiveDeadline(
  deadline: ReturnType<typeof createDeadline>,
  parentSignal: AbortSignal,
  expiresAt: number,
) {
  if (deadline.timedOut() || Date.now() >= expiresAt) {
    throw new RegisteredGraphqlOperationError(
      "REQUEST_TIMEOUT",
      "GraphQL document timed out.",
    );
  }
  if (deadline.signal.aborted || parentSignal.aborted) {
    throw new RegisteredGraphqlOperationError(
      "REQUEST_CANCELLED",
      "GraphQL document was cancelled.",
    );
  }
}

function parseSelectedOperation(document: string, operationName?: string) {
  try {
    const parsed = parse(document, { maxTokens: GRAPHQL_LIMITS.tokens });
    const operation = getOperationAST(parsed, operationName);
    if (!operation) {
      throw new RegisteredGraphqlOperationError(
        "BAD_USER_INPUT",
        "A selected query or mutation operation is required.",
      );
    }
    if (operation.operation === "subscription") {
      throw new RegisteredGraphqlOperationError(
        "BAD_USER_INPUT",
        "Subscriptions are not supported.",
      );
    }
    return { operation, parsed };
  } catch (error) {
    if (error instanceof RegisteredGraphqlOperationError) throw error;
    const message =
      error instanceof GraphQLError
        ? error.message
        : "Invalid GraphQL document.";
    throw new RegisteredGraphqlOperationError("BAD_USER_INPUT", message);
  }
}

function fragmentDefinitions(document: DocumentNode) {
  return new Map(
    document.definitions.flatMap((definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION
        ? [[definition.name.value, definition] as const]
        : [],
    ),
  );
}

function rootFieldNames(
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  variables: Record<string, unknown> | undefined,
  names = new Set<string>(),
  fragmentStack = new Set<string>(),
) {
  for (const selection of selectionSet.selections) {
    if (!shouldIncludeSelection(selection, variables)) continue;
    if (selection.kind === Kind.FIELD) {
      names.add(selection.name.value);
      continue;
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      rootFieldNames(
        selection.selectionSet,
        fragments,
        variables,
        names,
        fragmentStack,
      );
      continue;
    }
    const name = selection.name.value;
    if (fragmentStack.has(name)) continue;
    const fragment = fragments.get(name);
    if (!fragment) continue;
    fragmentStack.add(name);
    rootFieldNames(
      fragment.selectionSet,
      fragments,
      variables,
      names,
      fragmentStack,
    );
    fragmentStack.delete(name);
  }
  return names;
}

function shouldIncludeSelection(
  selection: SelectionNode,
  variables: Record<string, unknown> | undefined,
) {
  if (!variables) return true;
  try {
    const skip = getDirectiveValues(GraphQLSkipDirective, selection, variables);
    if (skip?.if === true) return false;
    const include = getDirectiveValues(
      GraphQLIncludeDirective,
      selection,
      variables,
    );
    return include?.if !== false;
  } catch {
    // Yoga reports invalid directives before execution. Conservatively retain
    // the field in preflight so malformed input cannot weaken authorization.
    return true;
  }
}

function scopePreflightVariables(
  operation: OperationDefinitionNode,
  variables: Record<string, unknown>,
) {
  const result = getVariableValues(
    graphqlOperationValidationSchema,
    operation.variableDefinitions ?? [],
    variables,
    { maxErrors: 10 },
  );
  return result.errors ? undefined : result.coerced;
}

function requireMutationScopes(
  document: DocumentNode,
  operation: OperationDefinitionNode,
  principal: GraphqlPrincipal,
  variables: Record<string, unknown>,
) {
  if (operation.operation !== "mutation" || principal.kind === "session")
    return;
  const requiredScopes = [
    ...new Set(
      [
        ...rootFieldNames(
          operation.selectionSet,
          fragmentDefinitions(document),
          scopePreflightVariables(operation, variables),
        ),
      ].flatMap((field) => mutationScopes.get(field) ?? []),
    ),
  ];
  if (principal.kind === "anonymous") {
    throw new RegisteredGraphqlOperationError(
      "FORBIDDEN",
      "Authentication is required for this operation.",
      requiredScopes,
    );
  }
  const missing = requiredScopes.filter((scope) => {
    const [feature, action] = scope.split(":");
    return !hasRequiredFeatureScope(principal.scopes, {
      feature: feature as RestFeature,
      action: action as "read" | "write",
    });
  });
  if (missing.length > 0) {
    throw new RegisteredGraphqlOperationError(
      "FORBIDDEN",
      "Insufficient OAuth scope.",
      missing,
    );
  }
}

function result(
  analysis: GraphqlOperationAnalysis,
  payload: GraphqlResponsePayload,
): RegisteredGraphqlOperationResult {
  if (
    analysis.operationType !== "query" &&
    analysis.operationType !== "mutation"
  ) {
    throw new Error("Expected a selected GraphQL operation");
  }
  return {
    operationId: "document",
    operationName: analysis.operationName,
    operationType: analysis.operationType,
    success: !payload.errors?.length,
    ...(payload.data !== undefined ? { data: payload.data } : {}),
    ...(payload.errors?.length ? { errors: payload.errors } : {}),
  };
}

export async function runGraphqlDocument(input: {
  confirmed?: boolean;
  document: string;
  locale: AppLocale;
  operationName?: string;
  principal: GraphqlPrincipal;
  requestInfo?: RegisteredGraphqlOperationRequestInfo;
  signal: AbortSignal;
  variables?: Record<string, unknown>;
}): Promise<RegisteredGraphqlOperationResult> {
  const startedAt = Date.now();
  const variables = input.variables ?? {};
  let analysis = { ...UNKNOWN_ANALYSIS };
  let errorCount = 0;
  const deadline = createDeadline(input.signal, GRAPHQL_LIMITS.timeoutMs);
  const requireActive = () =>
    requireActiveDeadline(
      deadline,
      input.signal,
      startedAt + GRAPHQL_LIMITS.timeoutMs,
    );

  try {
    requireActive();
    requireDocumentByteLimit(input.document);
    requireActive();
    const { operation, parsed } = parseSelectedOperation(
      input.document,
      input.operationName,
    );
    requireActive();
    analysis = analyzeGraphqlOperation({
      document: parsed,
      operationName: input.operationName,
      variables,
    });
    requireActive();
    requireMutationScopes(parsed, operation, input.principal, variables);
    requireActive();
    if (operation.operation === "mutation" && input.confirmed !== true) {
      throw new RegisteredGraphqlOperationError(
        "CONFIRMATION_REQUIRED",
        "GraphQL mutations require explicit confirmation.",
      );
    }
    requireActive();
    const body = requestBody({
      document: input.document,
      operationName: input.operationName,
      variables,
    });
    requireActive();
    const url = safeGraphqlRequestUrl(input.requestInfo?.url);
    url.pathname = GRAPHQL_ENDPOINT;
    url.search = "";
    const response = await mcpGraphqlYoga.fetch(
      url,
      {
        method: "POST",
        body,
        headers: {
          ...Object.fromEntries(safeGraphqlRequestHeaders(input.requestInfo)),
          "content-type": "application/json",
        },
        signal: deadline.signal,
      },
      {
        locals: {
          locale: input.locale,
          requestId: input.requestInfo?.requestId ?? undefined,
        },
        operationObservation: "caller",
        principal: input.principal,
      },
    );
    requireActive();
    const payload = (await response.json()) as GraphqlResponsePayload;
    requireActive();
    errorCount = payload.errors?.length ?? 0;
    return result(analysis, payload);
  } catch (error) {
    errorCount = 1;
    if (error instanceof RegisteredGraphqlOperationError) throw error;
    if (deadline.timedOut()) {
      throw new RegisteredGraphqlOperationError(
        "REQUEST_TIMEOUT",
        "GraphQL document timed out.",
      );
    }
    if (input.signal.aborted) {
      throw new RegisteredGraphqlOperationError(
        "REQUEST_CANCELLED",
        "GraphQL document was cancelled.",
      );
    }
    const originalError =
      error instanceof Error ? error : new Error("Unknown execution failure");
    return result(analysis, {
      errors: [
        formatMaskedGraphqlError(
          new GraphQLError(originalError.message, { originalError }),
        ),
      ],
    });
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
