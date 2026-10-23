import { getAnonymousHomePageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { WorkspacePageLoadEvent } from "@/features/workspace/server/workspace-page-load-types";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import { loadAnonymousHomeInformation } from "./anonymous-home-sections";

/**
 * Loads the public half of `/`, which is the whole of what the server renders
 * there: the campus information and the copy for the product directory. The
 * viewer's own overview is fetched on the client, so nothing here depends on
 * who is asking and the result is safe to share from the public HTML cache.
 *
 * The returned copy is keyed `homeCopy` rather than `copy` so it does not
 * shadow the root layout's `LayoutCopy` in merged page data — the directory on
 * `/` is built from that layout copy.
 */
export async function loadHomePage({ locals }: WorkspacePageLoadEvent) {
  const startMs = monotonicNowMs();
  const locale = locals.locale;
  const homeCopy = getAnonymousHomePageCopy(locale);
  const information = await loadAnonymousHomeInformation({
    locale,
    requestId: locals.requestId,
  });
  const data = {
    homeCopy,
    information,
    locale,
  };

  logAppEvent("info", "workspace.load.finish", {
    event: "workspace.load.finish",
    ioObservedDurationMs: elapsedMs(startMs),
    requestId: locals.requestId,
    signedIn: false,
    source: "home",
    status: "ok",
  });

  return data;
}
