import { getCloudflareRequestContext } from "@/lib/adapters/cloudflare-runtime";
import {
  collectFeatureEvent,
  safeObservabilityRequestId,
} from "@/lib/db/observability-context";
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
  userId?: string | null;
};
export type FeatureOperationResult = {
  outcome: ExperienceOutcome;
  errorClass: ExperienceError;
};

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

/** Content-free, unsampled events; persistence is detached from the business result. */
export function recordFeatureOperation(
  context: FeatureOperationContext,
  result: FeatureOperationResult,
  durationMs: number,
) {
  try {
    const requestId = safeObservabilityRequestId(
      context.requestId ?? getCloudflareRequestContext()?.requestId,
    );
    const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    collectFeatureEvent({
      ...context,
      ...result,
      id: crypto.randomUUID(),
      occurredAt: new Date(),
      requestId,
      userId: context.userId ?? null,
      durationMs: duration,
    });
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
          outcome: result.outcome,
          errorClass: result.errorClass,
          requestId,
          durationMs: duration,
        },
      );
    }
  } catch {
    /* Observation must preserve the original response or exception. */
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
