import {
  deleteSettingsAccountAction,
  getSettingsPageCopy,
  linkSettingsAccountAction,
  unlinkSettingsAccountAction,
  updateSettingsProfileAction,
} from "@/features/settings/lib/settings-page-server";
import { getSettingsPageData } from "@/lib/settings-page-data";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request, url }) => {
  return {
    ...(await getSettingsPageData(request, url)),
    copy: getSettingsPageCopy(locals.locale),
  };
};

export const actions: Actions = {
  updateProfile: async ({ cookies, locals, request, url }) =>
    updateSettingsProfileAction({
      cookies,
      locale: locals.locale,
      request,
      url,
    }),
  unlinkAccount: async ({ locals, request, url }) =>
    unlinkSettingsAccountAction({ locale: locals.locale, request, url }),
  linkAccount: async ({ cookies, locals, request, url }) =>
    linkSettingsAccountAction({ cookies, locale: locals.locale, request, url }),
  deleteAccount: async ({ cookies, locals, request, url }) =>
    deleteSettingsAccountAction({
      cookies,
      locale: locals.locale,
      request,
      url,
    }),
};
