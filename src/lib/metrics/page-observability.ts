import { logAppEvent } from "@/lib/log/app-logger";
import { shouldLogSuccessfulRequest } from "@/lib/log/request-log-sampling";
import { writePageRequestAnalytics } from "@/lib/metrics/analytics-engine";
import type {
  PageAuthSignalPresence,
  PageCatalogDetailTab,
  PageSsrClass,
} from "@/lib/metrics/page-request-attribution";

export type PageAuthMode = "anonymous" | "authenticated";

type PageRequestAttribution = {
  authSignalPresence: PageAuthSignalPresence;
  catalogDetailTab: PageCatalogDetailTab;
  ssrClass: PageSsrClass;
};

export type PageObservedTimings = {
  appIoObservedDurationMs: number;
  authIoObservedDurationMs: number;
  totalIoObservedDurationMs: number;
};

export function recordPageRequestFinish(input: {
  attribution: PageRequestAttribution;
  authMode: PageAuthMode;
  locale: string;
  method: string;
  requestId: string;
  responseBytes?: number;
  routeId: string | null;
  status: number;
  timings: PageObservedTimings;
}) {
  const route = input.routeId ?? "unmatched";

  if (
    shouldLogSuccessfulRequest({
      durationMs: input.timings.totalIoObservedDurationMs,
      requestId: input.requestId,
      samplePercent: 10,
      status: input.status,
    })
  ) {
    logAppEvent(input.status >= 500 ? "error" : "info", "page.request.finish", {
      authMode: input.authMode,
      authSignalPresence: input.attribution.authSignalPresence,
      catalogDetailTab: input.attribution.catalogDetailTab,
      event: "page.request.finish",
      ioObservedDurationMs: input.timings.totalIoObservedDurationMs,
      locale: input.locale,
      method: input.method,
      requestId: input.requestId,
      responseBytes: input.responseBytes,
      route,
      source: "sveltekit",
      ssrClass: input.attribution.ssrClass,
      status: input.status,
    });
  }

  writePageRequestAnalytics({
    appIoObservedDurationMs: input.timings.appIoObservedDurationMs,
    authIoObservedDurationMs: input.timings.authIoObservedDurationMs,
    authMode: input.authMode,
    authSignalPresence: input.attribution.authSignalPresence,
    catalogDetailTab: input.attribution.catalogDetailTab,
    event: "finish",
    ioObservedDurationMs: input.timings.totalIoObservedDurationMs,
    locale: input.locale,
    method: input.method,
    responseBytes: input.responseBytes,
    route,
    ssrClass: input.attribution.ssrClass,
    status: input.status,
  });
}

export function recordPageRequestError(
  input: Omit<
    Parameters<typeof recordPageRequestFinish>[0],
    "responseBytes" | "status"
  > & {
    errorName: string;
  },
) {
  const route = input.routeId ?? "unmatched";
  const status = 500;

  logAppEvent("error", "page.request.error", {
    authMode: input.authMode,
    authSignalPresence: input.attribution.authSignalPresence,
    catalogDetailTab: input.attribution.catalogDetailTab,
    errorName: input.errorName,
    event: "page.request.error",
    ioObservedDurationMs: input.timings.totalIoObservedDurationMs,
    locale: input.locale,
    method: input.method,
    requestId: input.requestId,
    route,
    source: "sveltekit",
    ssrClass: input.attribution.ssrClass,
    status,
  });

  writePageRequestAnalytics({
    appIoObservedDurationMs: input.timings.appIoObservedDurationMs,
    authIoObservedDurationMs: input.timings.authIoObservedDurationMs,
    authMode: input.authMode,
    authSignalPresence: input.attribution.authSignalPresence,
    catalogDetailTab: input.attribution.catalogDetailTab,
    event: "error",
    ioObservedDurationMs: input.timings.totalIoObservedDurationMs,
    locale: input.locale,
    method: input.method,
    route,
    ssrClass: input.attribution.ssrClass,
    status,
  });
}
