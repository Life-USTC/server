import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../messages/en-us.json";
import zhCnMessages from "../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export const load: PageServerLoad = ({ locals }) => {
  const copy = messages[locals.locale];
  return {
    copy: {
      homepage: copy.homepage,
      metadata: copy.metadata.pages,
    },
  };
};
