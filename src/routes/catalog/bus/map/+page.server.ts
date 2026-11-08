import { getDemoBusMap } from "@/features/demo/server/demo-bus";
import {
  getDemoCopy,
  getDemoView,
} from "@/features/demo/server/demo-workspace";
import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../../messages/en-us.json";
import zhCnMessages from "../../../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export const load: PageServerLoad = async ({ locals }) => {
  const copy = messages[locals.locale];
  return {
    copy: {
      busDayType: copy.bus.dayType,
      busMap: copy.busMap,
      metadata: copy.metadata.pages,
    },
    sampleNotice: locals.demo ? getDemoCopy(locals.locale).campusSamples : null,
    demo: locals.demo ? getDemoView(locals.demo, locals.locale) : null,
    data: locals.demo
      ? getDemoBusMap(locals.locale)
      : await (
          await import("@/features/bus/server/bus-transit-map")
        ).getBusMapData({ locale: locals.locale }),
    locale: locals.locale,
  };
};
