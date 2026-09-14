import {
  getCloudflareAnalyticsEngineDataset,
  getCloudflareRequestContext,
  getCloudflareRuntimeContext,
} from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";

export const EXPERIENCE_FEATURES = [
  "catalog.search",
  "catalog.course",
  "catalog.section",
  "catalog.teacher",
  "workspace.overview",
  "workspace.subscription",
  "workspace.homework",
  "community.section-homework",
] as const;
export type ExperienceFeature = (typeof EXPERIENCE_FEATURES)[number];
export type ExperienceProtocol = "web" | "rest" | "graphql" | "mcp";
export type ExperienceSurface = "web" | "mcp" | "unknown";
export type ExperienceAuth = "anonymous" | "session" | "oauth" | "unknown";
export type ExperienceOperation =
  | "view"
  | "list"
  | "get"
  | "search"
  | "match"
  | "create"
  | "update"
  | "delete"
  | "set_completion"
  | "import"
  | "batch";
export type ExperienceOutcome = "success" | "rejected" | "error" | "unknown";
export type ExperienceError =
  | "none"
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "dependency"
  | "internal"
  | "unknown";
export type FeatureOperation = {
  feature: ExperienceFeature;
  operation: ExperienceOperation;
};
export type FeatureOperationContext = FeatureOperation & {
  protocol: ExperienceProtocol;
  surface: ExperienceSurface;
  authMode: ExperienceAuth;
  requestId?: string;
};
export type FeatureOperationResult = {
  outcome: ExperienceOutcome;
  errorClass: ExperienceError;
};

const TELEMETRY_FAILURE_REPORTED = Symbol("feature.telemetry.failure");

const SUCCESS: FeatureOperationResult = {
  outcome: "success",
  errorClass: "none",
};
const UNKNOWN: FeatureOperationResult = {
  outcome: "unknown",
  errorClass: "unknown",
};

export function classifyFeatureStatus(status: number): FeatureOperationResult {
  if (status === 207) return UNKNOWN;
  if (status >= 200 && status < 300) return SUCCESS;
  if (status >= 500 && status < 600)
    return {
      outcome: "error",
      errorClass:
        status === 502 || status === 503 || status === 504
          ? "dependency"
          : "internal",
    };
  if (status >= 400 && status < 500) {
    const errors: Record<number, ExperienceError> = {
      400: "invalid_input",
      401: "unauthorized",
      403: "forbidden",
      404: "not_found",
      409: "conflict",
      422: "invalid_input",
      429: "rate_limited",
    };
    return { outcome: "rejected", errorClass: errors[status] ?? "unknown" };
  }
  // A redirect is not evidence that the requested operation ran successfully.
  return UNKNOWN;
}

export function classifyFeatureError(error: unknown): FeatureOperationResult {
  if (typeof error !== "object" || error === null)
    return { outcome: "error", errorClass: "internal" };
  if ("status" in error && typeof error.status === "number")
    return classifyFeatureStatus(error.status);
  if ("statusCode" in error && typeof error.statusCode === "number")
    return classifyFeatureStatus(error.statusCode);
  if ("name" in error && error.name === "ZodError")
    return { outcome: "rejected", errorClass: "invalid_input" };
  if (
    "extensions" in error &&
    typeof error.extensions === "object" &&
    error.extensions !== null &&
    "code" in error.extensions
  ) {
    const codes: Record<string, number> = {
      BAD_USER_INPUT: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
    };
    const code = error.extensions.code;
    if (typeof code === "string" && codes[code])
      return classifyFeatureStatus(codes[code]);
  }
  return { outcome: "error", errorClass: "internal" };
}

/** No messages, payloads, URLs, actor IDs, or client-supplied names enter the sink. */
export function recordFeatureOperation(
  context: FeatureOperationContext,
  result: FeatureOperationResult,
  durationMs: number,
) {
  let written = false;
  try {
    const dataset = getCloudflareAnalyticsEngineDataset();
    if (!dataset || typeof dataset.writeDataPoint !== "function") return;
    const candidateId =
      context.requestId ?? getCloudflareRequestContext()?.requestId;
    const requestId =
      candidateId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        candidateId,
      )
        ? candidateId
        : "";
    const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    dataset.writeDataPoint({
      indexes: [`feature:${context.feature}`],
      blobs: [
        "feature_operation_v1",
        context.feature,
        context.operation,
        context.protocol,
        context.surface,
        context.authMode,
        result.outcome,
        result.errorClass,
        requestId,
      ],
      doubles: [duration],
    });
    written = true;
    if (
      result.outcome === "error" ||
      (result.outcome === "unknown" && result.errorClass !== "none")
    ) {
      logAppEvent(
        result.outcome === "error" ? "error" : "warn",
        "feature.operation.finish",
        {
          event: "feature.operation.finish",
          feature: context.feature,
          operation: context.operation,
          protocol: context.protocol,
          surface: context.surface,
          authMode: context.authMode,
          outcome: result.outcome,
          errorClass: result.errorClass,
          requestId,
          durationMs: duration,
        },
      );
    }
  } catch {
    if (written) return;
    // Report lost coverage once per request without retrying on the business path.
    try {
      const cache = getCloudflareRuntimeContext()?.cache;
      if (!cache?.has(TELEMETRY_FAILURE_REPORTED)) {
        cache?.set(TELEMETRY_FAILURE_REPORTED, true);
        logAppEvent("warn", "feature.telemetry.failure", {
          event: "feature.telemetry.failure",
          reason: "write_failed",
        });
      }
    } catch {
      /* Telemetry must never replace a business result. */
    }
  }
}

export async function observeFeatureOperation<T>(
  context: FeatureOperationContext,
  run: () => T | Promise<T>,
  classify?: (value: T) => FeatureOperationResult,
  classifyError: (
    error: unknown,
  ) => FeatureOperationResult = classifyFeatureError,
): Promise<T> {
  const started = monotonicNowMs();
  let outcome = SUCCESS;
  try {
    const value = await run();
    if (classify) {
      try {
        outcome = classify(value);
      } catch {
        outcome = UNKNOWN;
      }
    }
    return value;
  } catch (error) {
    try {
      outcome = classifyError(error);
    } catch {
      outcome = UNKNOWN;
    }
    throw error;
  } finally {
    recordFeatureOperation(context, outcome, elapsedMs(started));
  }
}
