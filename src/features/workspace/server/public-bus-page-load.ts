import { getPublicBusPageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { WorkspacePageLoadEvent } from "@/features/workspace/server/workspace-page-load-types";
import { getBusTabData } from "@/features/workspace/server/workspace-tab-data";

export async function loadPublicBusPage({ locals }: WorkspacePageLoadEvent) {
  const bus = await getBusTabData(null, locals.locale);

  return {
    bus: bus.data,
    copy: getPublicBusPageCopy(locals.locale),
    locale: locals.locale,
    signedIn: false,
  };
}
