import { Kind } from "graphql";
import type { Plugin } from "graphql-yoga";
import { parseBearerAuthorizationHeader } from "@/lib/auth/authorization-header";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { logAppEvent } from "@/lib/log/app-logger";
import { writeGraphqlOperationAnalytics } from "@/lib/metrics/analytics-engine";
import type { GraphqlPrincipal } from "./auth";
import type { GraphqlContext, GraphqlServerContext } from "./context";
import {
  analyzeGraphqlOperation,
  type GraphqlOperationAnalysis,
} from "./operation-analysis";

type GraphqlAuthMode = GraphqlPrincipal["kind"] | "unknown";
type GraphqlObservationState = GraphqlOperationAnalysis & {
  authMode: GraphqlAuthMode;
  errorCount: number;
  internalErrorCount: number;
  operationAttempted: boolean;
  recorded: boolean;
  requestId: string;
  startMs: number;
};

const EMPTY_ANALYSIS: GraphqlOperationAnalysis = {
  estimatedCost: 0,
  operationName: "unknown",
  operationType: "unknown",
  topLevelFieldCount: 0,
};

function recordVariables(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeRequestId(value: string | null | undefined) {
  return value && /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : "unknown";
}

function initialAuthMode(request: Request): GraphqlAuthMode {
  if (parseBearerAuthorizationHeader(request.headers)) return "oauth";
  if (hasRequestAuthSignal(request.headers)) return "session";
  return "unknown";
}

type GraphqlErrorCounts = {
  errorCount: number;
  internalErrorCount: number;
};

export function countInternalGraphqlErrors(errors: unknown): number {
  if (!Array.isArray(errors)) return 0;
  return errors.filter(
    (error) =>
      typeof error === "object" &&
      error !== null &&
      "extensions" in error &&
      typeof error.extensions === "object" &&
      error.extensions !== null &&
      "code" in error.extensions &&
      error.extensions.code === "INTERNAL_SERVER_ERROR",
  ).length;
}

function graphqlErrorCounts(result: unknown): GraphqlErrorCounts {
  if (Array.isArray(result)) {
    return result.reduce<GraphqlErrorCounts>(
      (total, item) => {
        const counts = graphqlErrorCounts(item);
        return {
          errorCount: total.errorCount + counts.errorCount,
          internalErrorCount:
            total.internalErrorCount + counts.internalErrorCount,
        };
      },
      { errorCount: 0, internalErrorCount: 0 },
    );
  }
  if (
    typeof result !== "object" ||
    result === null ||
    Symbol.asyncIterator in result
  ) {
    return { errorCount: 0, internalErrorCount: 0 };
  }

  const errors = "errors" in result ? result.errors : undefined;
  if (!Array.isArray(errors)) {
    return { errorCount: 0, internalErrorCount: 0 };
  }
  return {
    errorCount: errors.length,
    internalErrorCount: countInternalGraphqlErrors(errors),
  };
}

export function recordGraphqlOperationObservation(
  input: GraphqlOperationAnalysis & {
    authMode: GraphqlAuthMode;
    errorCount: number;
    internalErrorCount: number;
    ioObservedDurationMs: number;
    requestId?: string | null;
  },
) {
  const sanitizedObservation = {
    ...input,
    errorCount: Math.max(0, input.errorCount),
    internalErrorCount: Math.max(0, input.internalErrorCount),
    ioObservedDurationMs: Math.max(0, input.ioObservedDurationMs),
    requestId: safeRequestId(input.requestId),
  };
  const observation = {
    authMode: sanitizedObservation.authMode,
    errorCount: sanitizedObservation.errorCount,
    estimatedCost: sanitizedObservation.estimatedCost,
    internalErrorCount: sanitizedObservation.internalErrorCount,
    ioObservedDurationMs: sanitizedObservation.ioObservedDurationMs,
    operationName: sanitizedObservation.operationName,
    operationType: sanitizedObservation.operationType,
    requestId: sanitizedObservation.requestId,
    topLevelFieldCount: sanitizedObservation.topLevelFieldCount,
  };

  try {
    logAppEvent(
      observation.internalErrorCount > 0 ? "error" : "info",
      "GraphQL operation completed",
      {
        event: "graphql.operation",
        ...observation,
      },
    );
  } catch {
    // Observability sinks must never affect the GraphQL response.
  }
  try {
    writeGraphqlOperationAnalytics(observation);
  } catch {
    // Keep sinks isolated so one failure cannot suppress the other.
  }
}

function recordObservation(state: GraphqlObservationState) {
  recordGraphqlOperationObservation({
    authMode: state.authMode,
    errorCount: state.errorCount,
    estimatedCost: state.estimatedCost,
    internalErrorCount: state.internalErrorCount,
    ioObservedDurationMs: Date.now() - state.startMs,
    operationName: state.operationName,
    operationType: state.operationType,
    requestId: state.requestId,
    topLevelFieldCount: state.topLevelFieldCount,
  });
}

export function createGraphqlObservabilityPlugin(): Plugin<
  GraphqlContext & GraphqlServerContext,
  GraphqlServerContext,
  GraphqlContext
> {
  const states = new WeakMap<Request, GraphqlObservationState>();

  return {
    onRequest({ request, serverContext }) {
      if (serverContext.operationObservation === "caller") return;
      states.set(request, {
        ...EMPTY_ANALYSIS,
        authMode: initialAuthMode(request),
        errorCount: 0,
        internalErrorCount: 0,
        operationAttempted: false,
        recorded: false,
        requestId: safeRequestId(serverContext.locals?.requestId),
        startMs: Date.now(),
      });
    },
    onParams({ request }) {
      const state = states.get(request);
      if (state) state.operationAttempted = true;
    },
    onParse({ context }) {
      return ({ result }) => {
        if (result?.kind !== Kind.DOCUMENT) return;
        const state = states.get(context.request);
        if (!state) return;

        Object.assign(
          state,
          analyzeGraphqlOperation({
            document: result,
            operationName: context.params.operationName,
            variables: recordVariables(context.params.variables),
          }),
        );
      };
    },
    onExecute({ args }) {
      const state = states.get(args.contextValue.request);
      if (!state) return;

      state.authMode = args.contextValue.principal.kind;
      Object.assign(
        state,
        analyzeGraphqlOperation({
          document: args.document,
          operationName: args.operationName,
          variables: args.variableValues ?? {},
        }),
      );
    },
    onExecutionResult({ request, result }) {
      const state = states.get(request);
      if (!state) return;
      const counts = graphqlErrorCounts(result);
      state.errorCount += counts.errorCount;
      state.internalErrorCount += counts.internalErrorCount;
    },
    onResponse({ request }) {
      const state = states.get(request);
      states.delete(request);
      if (!state || state.recorded || !state.operationAttempted) return;

      state.recorded = true;
      recordObservation(state);
    },
  };
}
