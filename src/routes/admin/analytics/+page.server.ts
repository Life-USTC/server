import { getAdminAnalyticsPage } from "@/features/admin/server/admin-audit-page-data";
import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";
import type { PageServerLoad } from "./$types";

const messages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

export const load: PageServerLoad = async ({ locals, request, url }) => ({
  ...(await getAdminAnalyticsPage(request, url)),
  copy: {
    admin: messages[locals.locale].admin,
    analytics: messages[locals.locale].adminAnalytics,
    audit: messages[locals.locale].adminAudit,
  },
  locale: locals.locale,
});
