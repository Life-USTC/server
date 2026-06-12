import type { AppLocale } from "@/i18n/config";
import { getAdminUsersPage } from "@/lib/admin-page-data";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const messages = {
  "zh-cn": zhCnMessages,
  "en-us": enUsMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

function getCopy(locale: AppLocale) {
  const copy = messages[locale];
  return {
    admin: copy.admin,
    adminUsers: copy.adminUsers,
    common: copy.common,
    moderation: copy.moderation,
  };
}

export const load: PageServerLoad = async ({ locals, request, url }) => {
  return {
    ...(await getAdminUsersPage(request, url)),
    locale: locals.locale,
    copy: getCopy(locals.locale),
  };
};
