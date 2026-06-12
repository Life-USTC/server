import type { AppLocale } from "@/i18n/config";
import { getAdminHomeData } from "@/lib/admin-page-data";
import enUsMessages from "../../../messages/en-us.json";
import zhCnMessages from "../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const adminMessages = {
  "en-us": { admin: enUsMessages.admin, common: enUsMessages.common },
  "zh-cn": { admin: zhCnMessages.admin, common: zhCnMessages.common },
} satisfies Record<
  AppLocale,
  { admin: typeof enUsMessages.admin; common: typeof enUsMessages.common }
>;

export const load: PageServerLoad = async ({ locals, request }) => {
  const data = await getAdminHomeData(request);
  const { admin: copy, common } = adminMessages[locals.locale];
  return {
    ...data,
    copy: {
      common,
      title: copy.title,
      subtitle: copy.subtitle,
      moderationTitle: copy.moderationTitle,
      moderationDescription: copy.moderationDescription,
      usersTitle: copy.usersTitle,
      usersDescription: copy.usersDescription,
      oauthTitle: copy.oauthTitle,
      oauthDescription: copy.oauthDescription,
      busTitle: copy.busTitle,
      busDescription: copy.busDescription,
      dashboard: copy.dashboard,
    },
  };
};
