import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const welcomeMessages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
};

export function getWelcomeCopy(locale: AppLocale) {
  const messages = welcomeMessages[locale];
  return {
    accessibility: messages.accessibility,
    profile: messages.profile,
    subscriptions: messages.subscriptions,
    welcome: messages.welcome,
  };
}
