import type { Cookies } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";
import { updateOwnProfile } from "@/features/profile/server/profile-update-service";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { getSessionFromHeaders } from "@/lib/auth/core";
import { applyAuthResponseCookies } from "@/lib/auth/svelte-auth-actions";
import { resolveWelcomeCallbackUrl } from "./welcome-callback-url";
import { getWelcomeCopy } from "./welcome-page-copy";
import { parseWelcomeProfileForm } from "./welcome-profile-form";

export async function completeWelcomeProfile({
  locals,
  request,
  cookies,
}: {
  cookies: Cookies;
  locals: App.Locals;
  request: Request;
}) {
  const copy = getWelcomeCopy(locals.locale);
  const form = await request.formData();
  const { callbackUrl, image, name, username } = parseWelcomeProfileForm(form);
  const redirectTo = resolveWelcomeCallbackUrl(callbackUrl);
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(
      303,
      buildSignInPageUrl(
        `/welcome?callbackUrl=${encodeURIComponent(redirectTo)}`,
      ),
    );
  }

  const result = await updateOwnProfile({
    headers: request.headers,
    image,
    name,
    userId: session.user.id,
    username,
  });
  if (!result.ok) {
    if (result.reason === "name_required") {
      return fail(400, { message: copy.profile.nameRequired });
    }
    if (result.reason === "invalid_username") {
      return fail(400, { message: copy.profile.usernameInvalid });
    }
    if (result.reason === "user_not_found") {
      return fail(404, { message: copy.profile.userNotFound });
    }
    if (result.reason === "avatar_invalid") {
      return fail(400, { message: copy.profile.avatarInvalid });
    }
    return fail(400, { message: copy.profile.usernameTaken });
  }

  applyAuthResponseCookies(result.headers, cookies);
  throw redirect(303, redirectTo);
}
