import { error, fail, redirect } from "@sveltejs/kit";
import { revokeUserOAuthAuthorization } from "@/features/oauth/server/user-authorizations.server";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import type { SettingsActionInput } from "@/features/settings/server/settings-page-common";
import { requireSettingsUser } from "@/features/settings/server/settings-page-data";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";

function assertTrustedSettingsActionOrigin(request: Request) {
  const origin =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin || origin === "null" || !isTrustedAuthOrigin(origin)) {
    throw error(403, "Invalid origin");
  }
}

export async function revokeSettingsAuthorizationAction({
  locale,
  request,
  url,
}: SettingsActionInput) {
  assertTrustedSettingsActionOrigin(request);
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const form = await request.formData();
  const consentId = String(form.get("consentId") ?? "").trim();
  if (!consentId) {
    return fail(400, {
      kind: "authorizations",
      message: copy.settings.authorizations.revokeNotFound,
    });
  }

  let result: Awaited<ReturnType<typeof revokeUserOAuthAuthorization>>;
  try {
    result = await revokeUserOAuthAuthorization(user.id, consentId);
  } catch {
    return fail(500, {
      kind: "authorizations",
      message: copy.settings.authorizations.revokeError,
    });
  }
  if (!result.ok) {
    return fail(404, {
      kind: "authorizations",
      message: copy.settings.authorizations.revokeNotFound,
    });
  }

  throw redirect(303, "/settings/authorizations?message=AuthorizationRevoked");
}
