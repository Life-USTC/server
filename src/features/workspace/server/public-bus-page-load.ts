import { getPublicBusPageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { WorkspacePageLoadEvent } from "@/features/workspace/server/workspace-page-load-types";
import { getWorkspaceUserId } from "@/features/workspace/server/workspace-page-server";
import { getBusTabData } from "@/features/workspace/server/workspace-tab-data";

export async function loadPublicBusPage({
  locals,
  request,
}: WorkspacePageLoadEvent) {
  const userId = await getWorkspaceUserId(request);
  const bus = await getBusTabData(userId, locals.locale);

  return {
    bus: bus.data,
    copy: getPublicBusPageCopy(locals.locale),
    locale: locals.locale,
    signedIn: Boolean(userId),
  };
}
