import { logAppEvent } from "@/lib/log/app-logger";
import { isProductionEnvironment } from "@/lib/log/app-logger-core";
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

function shouldLogSuccessfulPage(requestId: string) {
  if (!isProductionEnvironment()) return true;
  let hash = 0;
  for (let index = 0; index < requestId.length; index += 1) {
    hash = (hash * 31 + requestId.charCodeAt(index)) >>> 0;
  }
  return hash % 10 === 0;
}

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
    input.status >= 400 ||
    input.timings.totalIoObservedDurationMs >= 1_000 ||
    shouldLogSuccessfulPage(input.requestId)
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
