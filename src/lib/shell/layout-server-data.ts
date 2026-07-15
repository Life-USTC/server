import enUsMessages from "../../../messages/en-us.json";
import zhCnMessages from "../../../messages/zh-cn.json";

const layoutMessages = {
  "en-us": {
    admin: enUsMessages.admin,
    common: enUsMessages.common,
    homepage: enUsMessages.homepage,
    language: enUsMessages.language,
    meDashboard: enUsMessages.meDashboard,
    metadata: enUsMessages.metadata,
    notFound: enUsMessages.notFound,
    profile: enUsMessages.profile,
    theme: enUsMessages.theme,
  },
  "zh-cn": {
    admin: zhCnMessages.admin,
    common: zhCnMessages.common,
    homepage: zhCnMessages.homepage,
    language: zhCnMessages.language,
    meDashboard: zhCnMessages.meDashboard,
    metadata: zhCnMessages.metadata,
    notFound: zhCnMessages.notFound,
    profile: zhCnMessages.profile,
    theme: zhCnMessages.theme,
  },
};

type LayoutLocale = keyof typeof layoutMessages;

export type LayoutUserInput = {
  id: string;
  image?: string | null;
  isAdmin?: boolean;
  name?: string | null;
  username?: unknown;
} | null;

export function buildLayoutCopy(locale: LayoutLocale) {
  const messages = layoutMessages[locale];
  return {
    description: messages.metadata.description,
    metadata: {
      social: messages.metadata.social,
      title: messages.metadata.title,
    },
    nav: {
      courses: messages.common.courses,
      dashboard: messages.metadata.pages.meDashboard,
      sections: messages.common.sections,
      teachers: messages.common.teachers,
      overview: messages.meDashboard.nav.overview.title,
      workspaceOverview: locale === "zh-cn" ? "工作台首页" : "Workspace start",
      calendar: messages.meDashboard.nav.calendar.title,
      workspaceCalendar:
        locale === "zh-cn" ? "工作台日程" : "Workspace schedule",
      bus: messages.meDashboard.nav.bus.title,
      dashboardBus: locale === "zh-cn" ? "工作台校车" : "Dashboard transit",
      workspaceTransit: locale === "zh-cn" ? "工作台交通" : "Workspace transit",
      subscriptions: messages.meDashboard.nav.subscriptions.title,
      workspaceSubscriptions:
        locale === "zh-cn" ? "工作台课程规划" : "Workspace course planning",
      homeworks: messages.meDashboard.nav.homeworks.title,
      workspaceHomeworks:
        locale === "zh-cn" ? "工作台任务" : "Workspace assignments",
      exams: messages.meDashboard.nav.exams.title,
      workspaceExams:
        locale === "zh-cn" ? "工作台评估" : "Workspace assessments",
      links: messages.meDashboard.nav.links.title,
      workspaceWebsites:
        locale === "zh-cn" ? "工作台网站目录" : "Workspace web directory",
      todos: messages.meDashboard.nav.todos.title,
      workspaceTodos: locale === "zh-cn" ? "工作台事项" : "Workspace tasks",
      transitMap: messages.metadata.pages.busMap,
      mobileApp: messages.metadata.pages.mobileApp,
      groups: {
        workspace: locale === "zh-cn" ? "工作台" : "Workspace",
        publicTools: locale === "zh-cn" ? "公开工具" : "Public tools",
        catalog: locale === "zh-cn" ? "课程目录" : "Catalog",
        campus: locale === "zh-cn" ? "校园" : "Campus",
        adminTools: locale === "zh-cn" ? "管理工具" : "Admin tools",
      },
      admin: {
        title: messages.admin.title,
        moderation: messages.admin.moderationTitle,
        users: messages.admin.usersTitle,
        oauth: messages.admin.oauthTitle,
        bus: messages.admin.busTitle,
      },
    },
    menu: {
      home: messages.common.home,
      me: messages.common.me,
      settings: messages.metadata.pages.settings,
      signIn: messages.common.signIn,
      signOut: messages.profile.signOut,
    },
    footer: {
      locale: locale === "zh-cn" ? "语言" : "Locale",
      terms: messages.common.terms,
      privacy: messages.common.privacy,
      mobileApp: messages.homepage.actions.mobileApp,
    },
    shell: {
      footerNavigation: messages.common.footerNavigation,
      loading: messages.common.loading,
      menu: locale === "zh-cn" ? "菜单" : "Menu",
      primaryNavigation: messages.common.primaryNavigation,
      profileMenu: messages.common.profileMenu,
      theme: locale === "zh-cn" ? "主题" : "Theme",
    },
    errorPage: {
      backHome: messages.common.backToHome,
      error: messages.common.error,
      notFoundDescription: messages.notFound.description,
      notFoundTitle: messages.notFound.title,
      somethingWentWrong: messages.common.somethingWentWrong,
      tryAgain: messages.common.tryAgain,
    },
    language: messages.language,
    theme: messages.theme,
  };
}

export type LayoutCopy = ReturnType<typeof buildLayoutCopy>;

export type LayoutUserSummary = {
  id: string;
  image: string | null;
  isAdmin: boolean;
  name: string | null;
  username: string | null;
} | null;

export function layoutUserSummary(
  user: LayoutUserInput | null | undefined,
): LayoutUserSummary {
  return user
    ? {
        id: user.id,
        name: user.name ?? null,
        image: user.image ?? null,
        isAdmin: Boolean(user.isAdmin),
        username: typeof user.username === "string" ? user.username : null,
      }
    : null;
}
