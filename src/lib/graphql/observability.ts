import { Kind } from "graphql";
import type { Plugin } from "graphql-yoga";
import { logAppEvent } from "@/lib/log/app-logger";
import { writeGraphqlOperationAnalytics } from "@/lib/metrics/analytics-engine";
import {
  analyzeGraphqlOperation,
  type GraphqlOperationAnalysis,
} from "./operation-analysis";
import type { GraphqlContext, GraphqlServerContext } from "./schema";

type GraphqlObservationState = GraphqlOperationAnalysis & {
  authMode: "anonymous";
  errorCount: number;
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

function errorCount(result: unknown): number {
  if (Array.isArray(result)) {
    return result.reduce((total, item) => total + errorCount(item), 0);
  }
  if (
    typeof result !== "object" ||
    result === null ||
    Symbol.asyncIterator in result
  ) {
    return 0;
  }

  const errors = "errors" in result ? result.errors : undefined;
  return Array.isArray(errors) ? errors.length : 0;
}

function recordObservation(state: GraphqlObservationState) {
  const durationMs = Math.max(0, Date.now() - state.startMs);
  const observation = {
    authMode: state.authMode,
    durationMs,
    errorCount: state.errorCount,
    estimatedCost: state.estimatedCost,
    operationName: state.operationName,
    operationType: state.operationType,
    requestId: state.requestId,
    topLevelFieldCount: state.topLevelFieldCount,
  };

  try {
    logAppEvent("info", "GraphQL operation completed", {
      event: "graphql.operation",
      ...observation,
    });
  } catch {
    // Observability sinks must never affect the GraphQL response.
  }
  try {
    writeGraphqlOperationAnalytics(observation);
  } catch {
    // Keep sinks isolated so one failure cannot suppress the other.
  }
}

export function createGraphqlObservabilityPlugin(): Plugin<
  GraphqlContext & GraphqlServerContext,
  GraphqlServerContext,
  GraphqlContext
> {
  const states = new WeakMap<Request, GraphqlObservationState>();

  return {
    onRequest({ request, serverContext }) {
      states.set(request, {
        ...EMPTY_ANALYSIS,
        authMode: "anonymous",
        errorCount: 0,
        operationAttempted: false,
        recorded: false,
        requestId: safeRequestId(
          serverContext.locals?.requestId ??
            request.headers.get("x-request-id"),
        ),
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
      if (state) state.errorCount += errorCount(result);
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
