import { adminModerationPageActions } from "@/features/admin/server/admin-moderation-page-actions";
import { getAdminModerationPageCopy } from "@/features/admin/server/admin-moderation-page-copy";
import { getAdminModerationPage } from "@/lib/admin-page-data";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request, url }) => {
  return {
    ...(await getAdminModerationPage(request, url)),
    locale: locals.locale,
    copy: getAdminModerationPageCopy(locals.locale),
  };
};

export const actions: Actions = adminModerationPageActions;
