import { getAnonymousHomePageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { logAppEvent } from "@/lib/log/app-logger";

export async function loadAnonymousHomePage({
  locals,
}: DashboardPageLoadEvent) {
  const startMs = Date.now();
  const locale = locals.locale;
  const data = {
    copy: getAnonymousHomePageCopy(locale),
    locale,
    signedIn: false as const,
  };

  logAppEvent("info", "dashboard.load.finish", {
    durationMs: Date.now() - startMs,
    event: "dashboard.load.finish",
    requestId: locals.requestId,
    signedIn: false,
    source: "home",
    status: "ok",
  });

  return data;
}
