import type { Cookies } from "@sveltejs/kit";
import {
  deleteSettingsAccountAction,
  linkSettingsAccountAction,
  unlinkSettingsAccountAction,
} from "@/features/settings/server/settings-account-actions";
import { revokeSettingsAuthorizationAction } from "@/features/settings/server/settings-authorization-actions";
import { updateSettingsProfileAction } from "@/features/settings/server/settings-profile-action";
import type { AppLocale } from "@/i18n/config";

type SettingsActionEvent = {
  cookies: Cookies;
  locals: {
    locale: AppLocale;
    requestId: string;
  };
  request: Request;
  url: URL;
};

export const settingsPageActions = {
  updateProfile: async ({
    cookies,
    locals,
    request,
    url,
  }: SettingsActionEvent) =>
    updateSettingsProfileAction({
      cookies,
      locale: locals.locale,
      request,
      url,
    }),
  unlinkAccount: async ({ locals, request, url }: SettingsActionEvent) =>
    unlinkSettingsAccountAction({ locale: locals.locale, request, url }),
  linkAccount: async ({ cookies, locals, request, url }: SettingsActionEvent) =>
    linkSettingsAccountAction({ cookies, locale: locals.locale, request, url }),
  revokeAuthorization: async ({ locals, request, url }: SettingsActionEvent) =>
    revokeSettingsAuthorizationAction({
      locale: locals.locale,
      request,
      requestId: locals.requestId,
      url,
    }),
  deleteAccount: async ({
    cookies,
    locals,
    request,
    url,
  }: SettingsActionEvent) =>
    deleteSettingsAccountAction({
      cookies,
      locale: locals.locale,
      request,
      url,
    }),
};
