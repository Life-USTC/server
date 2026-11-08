import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import { getDemoBusTimetable } from "@/features/demo/server/demo-bus";
import {
  getDemoCopy,
  getDemoView,
} from "@/features/demo/server/demo-workspace";
import { getPublicBusPageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { WorkspacePageLoadEvent } from "@/features/workspace/server/workspace-page-load-types";
import { getBusTabData } from "@/features/workspace/server/workspace-tab-data";

export async function loadPublicBusPage({
  locals,
}: WorkspacePageLoadEvent & { locals: { demo?: DemoIdentity | null } }) {
  const bus = locals.demo
    ? { data: getDemoBusTimetable(locals.locale) }
    : await getBusTabData(null, locals.locale);

  return {
    bus: bus.data,
    sampleNotice: locals.demo ? getDemoCopy(locals.locale).campusSamples : null,
    demo: locals.demo ? getDemoView(locals.demo, locals.locale) : null,
    copy: getPublicBusPageCopy(locals.locale),
    locale: locals.locale,
    signedIn: false,
  };
}
