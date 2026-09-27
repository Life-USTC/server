import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

export function getUploadPageCopy(locale: AppLocale) {
  const messages = locale === "en-us" ? enUsMessages : zhCnMessages;
  return { uploads: messages.uploads, common: messages.common };
}
