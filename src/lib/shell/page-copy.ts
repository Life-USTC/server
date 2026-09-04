import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../messages/en-us.json";
import zhCnMessages from "../../../messages/zh-cn.json";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export type WorkspacePageCopy = ReturnType<typeof getWorkspacePageCopy>;
export type AppPageCopy = WorkspacePageCopy;

export function getWorkspacePageCopy(locale: AppLocale) {
  const copy = messages[locale];

  return {
    bus: copy.bus,
    CalendarEventCard: copy.CalendarEventCard,
    common: copy.common,
    comments: copy.comments,
    workspace: copy.workspace,
    homepage: copy.homepage,
    homeworks: copy.homeworks,
    metadata: copy.metadata.pages,
    myHomeworks: copy.myHomeworks,
    sectionDetail: copy.sectionDetail,
    subscriptions: copy.subscriptions,
    todos: copy.todos,
    weather: copy.weather,
    youngEvents: copy.youngEvents,
  };
}

export function getAnonymousHomePageCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    homepage: {
      actions: copy.homepage.actions,
      appIconAlt: copy.homepage.appIconAlt,
      publicWorkspace: copy.homepage.publicWorkspace,
      subtitle: copy.homepage.subtitle,
      title: copy.homepage.title,
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
    workspace: {
      nav: {
        bus: copy.workspace.nav.bus,
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
    workspace: {
      linkHub: copy.workspace.linkHub,
      nav: {
        links: copy.workspace.nav.links,
      },
    },
    metadata: {
      home: copy.metadata.pages.home,
    },
  };
}
