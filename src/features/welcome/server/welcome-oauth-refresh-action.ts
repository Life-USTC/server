import { type Cookies, fail, redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { getSessionFromHeaders } from "@/lib/auth/core";
import { linkAccountFromSvelteAction } from "@/lib/auth/svelte-auth-actions";
import { prisma } from "@/lib/db/prisma";
import { logServerActionError } from "@/lib/log/app-logger";
import { resolveWelcomeCallbackUrl } from "./welcome-callback-url";
import { getWelcomeCopy } from "./welcome-page-copy";

const REFRESHABLE_PROVIDERS = new Set(["github", "google", "oidc"]);

export async function refreshWelcomeOAuthProfile({
  cookies,
  locals,
  request,
}: {
  cookies: Cookies;
  locals: App.Locals;
  request: Request;
}) {
  const form = await request.formData();
  const callbackUrl = resolveWelcomeCallbackUrl(form.get("callbackUrl"));
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(
        `/account/welcome?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      ),
    );
  }

  const providerId = String(form.get("providerId") ?? "");
  if (!REFRESHABLE_PROVIDERS.has(providerId)) {
    return fail(400, {
      message: getWelcomeCopy(locals.locale).welcome.oauthRefreshFailed,
    });
  }
  const linkedAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: providerId,
    },
    select: { id: true },
  });
  if (!linkedAccount) {
    return fail(400, {
      message: getWelcomeCopy(locals.locale).welcome.oauthRefreshNotLinked,
    });
  }

  const returnTo = `/account/welcome?callbackUrl=${encodeURIComponent(callbackUrl)}&oauthRefreshed=1`;
  try {
    const result = await linkAccountFromSvelteAction({
      providerId,
      callbackUrl: returnTo,
      headers: request.headers,
      cookies,
    });
    throw redirect(303, result.url);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      "location" in error
    ) {
      throw error;
    }
    logServerActionError("auth.welcome_oauth_refresh.failed", error, {
      action: "refresh-oauth-profile",
      requestId: locals.requestId,
      route: "/account/welcome",
    });
    return fail(400, {
      message: getWelcomeCopy(locals.locale).welcome.oauthRefreshFailed,
    });
  }
}
