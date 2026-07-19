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

export function getAnonymousHomePageCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    homepage: {
      publicDashboard: copy.homepage.publicDashboard,
    },
    metadata: {
      home: copy.metadata.pages.home,
    },
  };
}

export function getPublicBusPageCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    bus: copy.bus,
    dashboard: {
      nav: {
        bus: copy.meDashboard.nav.bus,
      },
    },
    homepage: {
      publicDashboard: {
        title: copy.homepage.publicDashboard.title,
      },
    },
    metadata: {
      home: copy.metadata.pages.home,
    },
  };
}

export function getPublicLinksPageCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    dashboard: {
      linkHub: copy.meDashboard.linkHub,
      nav: {
        links: copy.meDashboard.nav.links,
      },
    },
    homepage: {
      publicDashboard: {
        title: copy.homepage.publicDashboard.title,
      },
    },
    metadata: {
      home: copy.metadata.pages.home,
    },
  };
}
