import { getAnonymousHomePageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";

export async function loadAnonymousHomePage({
  locals,
}: DashboardPageLoadEvent) {
  const startMs = monotonicNowMs();
  const locale = locals.locale;
  const data = {
    copy: getAnonymousHomePageCopy(locale),
    locale,
    signedIn: false as const,
  };

  logAppEvent("info", "dashboard.load.finish", {
    event: "dashboard.load.finish",
    ioObservedDurationMs: elapsedMs(startMs),
    requestId: locals.requestId,
    signedIn: false,
    source: "home",
    status: "ok",
  });

  return data;
}
