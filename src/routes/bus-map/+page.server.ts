import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../messages/en-us.json";
import zhCnMessages from "../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export const load: PageServerLoad = async ({ locals }) => {
  const { getBusMapData } = await import("@/features/bus/lib/bus-transit-map");
  const copy = messages[locals.locale];
  return {
    copy: {
      busDayType: copy.bus.dayType,
      busMap: copy.busMap,
      metadata: copy.metadata.pages,
    },
    data: await getBusMapData({
      locale: locals.locale === "en-us" ? "en-us" : "zh-cn",
    }),
    locale: locals.locale,
  };
};
