import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../messages/en-us.json";
import zhCnMessages from "../../messages/zh-cn.json";

const commentsMessages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
};

export function getCommentsCopy(locale: AppLocale) {
  const messages = commentsMessages[locale];
  return {
    comments: messages.comments,
    uploads: messages.uploads,
  };
}
