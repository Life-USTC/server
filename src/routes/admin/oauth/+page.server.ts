import {
  createAdminOAuthClientAction,
  deleteAdminOAuthClientAction,
  getAdminOAuthCopy,
} from "@/features/admin/server/admin-oauth-page-server";
import { getAdminOAuthPage } from "@/features/admin/server/admin-page-data";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request }) => {
  return {
    ...(await getAdminOAuthPage(request)),
    locale: locals.locale,
    copy: getAdminOAuthCopy(locals.locale),
  };
};

export const actions: Actions = {
  createClient: async ({ locals, request }) =>
    createAdminOAuthClientAction(request, locals.locale),
  deleteClient: async ({ locals, request }) =>
    deleteAdminOAuthClientAction(request, locals.locale),
};
