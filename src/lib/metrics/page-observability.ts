import { logAppEvent } from "@/lib/log/app-logger";
import { writePageRequestAnalytics } from "@/lib/metrics/analytics-engine";

export type PageAuthMode = "anonymous" | "authenticated";

export type PageServerTimings = {
  appDurationMs: number;
  authDurationMs: number;
  totalDurationMs: number;
};

function safeDuration(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function timingMetric(name: string, durationMs: number) {
  return `${name};dur=${Math.round(safeDuration(durationMs))}`;
}

export function appendPageServerTiming(
  headers: Headers,
  timings: PageServerTimings,
) {
  const value = [
    timingMetric("auth", timings.authDurationMs),
    timingMetric("app", timings.appDurationMs),
    timingMetric("total", timings.totalDurationMs),
  ].join(", ");

  headers.append("Server-Timing", value);
}

export function recordPageRequestFinish(input: {
  authMode: PageAuthMode;
  locale: string;
  method: string;
  requestId: string;
  responseBytes?: number;
  routeId: string | null;
  status: number;
  timings: PageServerTimings;
}) {
  const route = input.routeId ?? "unmatched";

  logAppEvent("info", "page.request.finish", {
    authMode: input.authMode,
    durationMs: input.timings.totalDurationMs,
    event: "page.request.finish",
    locale: input.locale,
    method: input.method,
    requestId: input.requestId,
    responseBytes: input.responseBytes,
    route,
    source: "sveltekit",
    status: input.status,
  });

  writePageRequestAnalytics({
    appDurationMs: input.timings.appDurationMs,
    authDurationMs: input.timings.authDurationMs,
    authMode: input.authMode,
    durationMs: input.timings.totalDurationMs,
    locale: input.locale,
    method: input.method,
    responseBytes: input.responseBytes,
    route,
    status: input.status,
  });
}
