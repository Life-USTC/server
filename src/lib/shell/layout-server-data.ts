import enUsMessages from "../../../messages/en-us.json";
import zhCnMessages from "../../../messages/zh-cn.json";

const layoutMessages = {
  "en-us": {
    common: enUsMessages.common,
    homepage: enUsMessages.homepage,
    language: enUsMessages.language,
    metadata: enUsMessages.metadata,
    notFound: enUsMessages.notFound,
    profile: enUsMessages.profile,
    theme: enUsMessages.theme,
  },
  "zh-cn": {
    common: zhCnMessages.common,
    homepage: zhCnMessages.homepage,
    language: zhCnMessages.language,
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
  name?: string | null;
  username?: unknown;
} | null;

export function buildLayoutCopy(locale: LayoutLocale) {
  const messages = layoutMessages[locale];
  return {
    description: messages.metadata.description,
    nav: {
      courses: messages.common.courses,
      sections: messages.common.sections,
      teachers: messages.common.teachers,
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
        username: typeof user.username === "string" ? user.username : null,
      }
    : null;
}
