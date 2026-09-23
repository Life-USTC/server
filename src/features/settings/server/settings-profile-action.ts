import { type Cookies, fail, redirect } from "@sveltejs/kit";
import { updateOwnProfile } from "@/features/profile/server/profile-update-service";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import { parseSettingsProfileForm } from "@/features/settings/lib/settings-profile-form";
import type { SettingsActionInput } from "@/features/settings/server/settings-page-common";
import { requireSettingsUser } from "@/features/settings/server/settings-page-data";
import { applyAuthResponseCookies } from "@/lib/auth/svelte-auth-actions";

export async function updateSettingsProfileAction({
  cookies,
  locale,
  request,
  url,
}: SettingsActionInput & { cookies: Cookies }) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const form = await request.formData();
  const { image, name, username } = parseSettingsProfileForm(form);
  const result = await updateOwnProfile({
    headers: request.headers,
    image,
    name,
    userId: user.id,
    username,
  });
  if (!result.ok) {
    if (result.reason === "name_required") {
      return fail(400, {
        kind: "profile",
        message: copy.profile.nameRequired,
      });
    }
    if (result.reason === "invalid_username") {
      return fail(400, {
        kind: "profile",
        message: copy.profile.usernameInvalid,
      });
    }
    if (result.reason === "user_not_found") {
      return fail(404, {
        kind: "profile",
        message: copy.common.userNotFound,
      });
    }
    if (result.reason === "avatar_invalid") {
      return fail(400, {
        kind: "profile",
        message: copy.profile.avatarInvalid,
      });
    }
    return fail(400, {
      kind: "profile",
      message: copy.profile.usernameTaken,
    });
  }

  applyAuthResponseCookies(result.headers, cookies);
  throw redirect(303, "/account/settings/profile?message=Success");
}
