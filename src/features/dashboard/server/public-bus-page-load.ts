import { getPublicBusPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { getDashboardUserId } from "@/features/dashboard/server/dashboard-page-server";
import { getBusTabData } from "@/features/dashboard/server/dashboard-tab-data";

export async function loadPublicBusPage({
  locals,
  request,
}: DashboardPageLoadEvent) {
  const userId = await getDashboardUserId(request);
  const bus = await getBusTabData(userId, locals.locale);

  return {
    bus: bus.data,
    copy: getPublicBusPageCopy(locals.locale),
    locale: locals.locale,
    signedIn: Boolean(userId),
  };
}
