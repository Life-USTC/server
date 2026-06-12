import { type Handle, redirect } from "@sveltejs/kit";
import { LOCALE_COOKIE, negotiateLocale } from "@/i18n/config";
import { shouldRedirectIncompleteProfileToWelcome } from "@/lib/auth/auth-routing";
import { getSessionFromHeaders } from "@/lib/auth/core";

export const handle: Handle = async ({ event, resolve }) => {
  const locale = negotiateLocale(
    event.cookies.get(LOCALE_COOKIE),
    event.request.headers.get("accept-language"),
  );
  event.locals.locale = locale;

  const session = await getSessionFromHeaders(event.request.headers);
  if (
    shouldRedirectIncompleteProfileToWelcome({
      pathname: event.url.pathname,
      url: event.url,
      hasUser: Boolean(session?.user.id),
      hasCompleteProfile: Boolean(session?.user.name && session.user.username),
    })
  ) {
    const returnTo = `${event.url.pathname}${event.url.search}`;
    throw redirect(303, `/welcome?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('<html lang="zh-CN">', `<html lang="${locale}">`),
  });
};
