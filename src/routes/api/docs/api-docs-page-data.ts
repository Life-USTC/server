import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export function loadApiDocsPageData(locale: AppLocale) {
  const copy = messages[locale];
  return {
    copy: {
      apiDocs: copy.apiDocs,
      common: copy.common,
      metadata: copy.metadata.pages,
    },
  };
}
