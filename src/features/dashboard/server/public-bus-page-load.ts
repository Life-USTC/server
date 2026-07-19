import { getPublicBusPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
import { getBusTabData } from "@/features/dashboard/server/dashboard-tab-data";

export async function loadPublicBusPage({ locals }: DashboardPageLoadEvent) {
  const bus = await getBusTabData(null, locals.locale);

  return {
    bus: bus.data,
    copy: getPublicBusPageCopy(locals.locale),
    locale: locals.locale,
  };
}
