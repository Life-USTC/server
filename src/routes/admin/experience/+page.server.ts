import { getAdminExperiencePage } from "@/features/admin/server/admin-experience-page-data";
import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const messages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export const load: PageServerLoad = async ({ locals, request, url }) => ({
  ...(await getAdminExperiencePage(request, url)),
  copy: {
    admin: messages[locals.locale].admin,
    experience: messages[locals.locale].adminExperience,
  },
  locale: locals.locale,
});
