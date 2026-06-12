import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export function getDashboardPageCopy(locale: AppLocale) {
  const copy = messages[locale];

  return {
    bus: copy.bus,
    CalendarEventCard: copy.CalendarEventCard,
    common: copy.common,
    comments: copy.comments,
    dashboard: copy.meDashboard,
    homepage: copy.homepage,
    homeworks: copy.homeworks,
    metadata: copy.metadata.pages,
    myHomeworks: copy.myHomeworks,
    sectionDetail: copy.sectionDetail,
    subscriptions: copy.subscriptions,
    todos: copy.todos,
  };
}
