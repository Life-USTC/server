import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export function getAdminOAuthCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    admin: copy.admin,
    common: copy.common,
    oauth: copy.oauth,
  };
}
