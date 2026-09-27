import { error, fail, redirect } from "@sveltejs/kit";
import { revokeUserOAuthAuthorization } from "@/features/oauth/server/user-authorizations.server";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import type { SettingsActionInput } from "@/features/settings/server/settings-page-common";
import { requireSettingsUser } from "@/features/settings/server/settings-page-data";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { resolveAuthoritativeSession } from "@/lib/auth/recent-session";
import { logServerActionError } from "@/lib/log/app-logger";

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
  requestId,
  url,
}: SettingsActionInput & { requestId?: string }) {
  assertTrustedSettingsActionOrigin(request);
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const session = await resolveAuthoritativeSession(request.headers, {
    expectedUserId: user.id,
  });
  if (!session.ok) {
    await fireAuditLog({
      action: "oauth_authorization_revoke",
      channel: "web",
      outcome: "denied",
      subjectUserId: user.id,
      targetType: "oauth_consent",
      userId: user.id,
      ...(session.sessionId ? { sessionId: session.sessionId } : {}),
      metadata: { reason: session.reason },
      ...getAuditRequestMetadata(request, requestId),
    });
    throw redirect(303, buildSignInPageUrl(url.pathname + url.search));
  }
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
    result = await revokeUserOAuthAuthorization(user.id, consentId, {
      ...getAuditRequestMetadata(request, requestId),
      channel: "web",
      sessionId: session.sessionId,
    });
  } catch (error) {
    logServerActionError("settings.authorization.revoke.failed", error, {
      action: "revoke-authorization",
      requestId,
      route: "/account/settings/authorizations",
    });
    await fireAuditLog({
      action: "oauth_authorization_revoke",
      channel: "web",
      outcome: "failure",
      sessionId: session.sessionId,
      subjectUserId: user.id,
      targetId: consentId,
      targetType: "oauth_consent",
      userId: user.id,
      ...getAuditRequestMetadata(request, requestId),
    });
    return fail(500, {
      kind: "authorizations",
      message: copy.settings.authorizations.revokeError,
    });
  }
  if (!result.ok) {
    await fireAuditLog({
      action: "oauth_authorization_revoke",
      channel: "web",
      outcome: "denied",
      sessionId: session.sessionId,
      subjectUserId: user.id,
      targetId: consentId,
      targetType: "oauth_consent",
      userId: user.id,
      metadata: { reason: "not_found" },
      ...getAuditRequestMetadata(request, requestId),
    });
    return fail(404, {
      kind: "authorizations",
      message: copy.settings.authorizations.revokeNotFound,
    });
  }

  throw redirect(
    303,
    "/account/settings/authorizations?message=AuthorizationRevoked",
  );
}
