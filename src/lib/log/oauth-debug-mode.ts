import { getOptionalTrimmedEnv } from "@/app-env";
import { getApiRequestObservabilityRequestId } from "@/lib/log/api-observability-context";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

export type OAuthDebugMode = "off" | "standard" | "verbose";

const OAUTH_DEBUG_DISABLED_VALUES = new Set(["", "0", "false"]);
const OAUTH_DEBUG_VERBOSE_VALUES = new Set(["verbose", "2"]);

export function getOAuthDebugMode(): OAuthDebugMode {
  const value =
    getOptionalTrimmedEnv("OAUTH_DEBUG_LOGGING")?.toLowerCase() ?? "";
  if (OAUTH_DEBUG_DISABLED_VALUES.has(value)) return "off";
  if (OAUTH_DEBUG_VERBOSE_VALUES.has(value)) return "verbose";
  return "standard";
}

export function isOAuthDebugLogging(): boolean {
  return getOAuthDebugMode() !== "off";
}

export function oauthDebugCorrelationId(request: Request): string {
  const requestId = getApiRequestObservabilityRequestId(request);
  if (requestId) return requestId;

  return (
    safeCorrelationId(request.headers.get("x-request-id")) ??
    request.headers.get("cf-ray") ??
    request.headers.get("traceparent")?.slice(0, 55) ??
    "no-correlation-id"
  );
}

function safeCorrelationId(value: string | null) {
  return value && /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : undefined;
}

export function logOAuthDebug(
  event: string,
  request: Request | undefined,
  fields: Record<string, unknown>,
): void {
  if (!isOAuthDebugLogging()) return;

  const payload: Record<string, unknown> = {
    ts: formatShanghaiTimestamp(new Date()),
    event,
    ...fields,
  };

  if (request) {
    payload.correlationId = oauthDebugCorrelationId(request);
  }

  console.info(JSON.stringify(payload));
}
