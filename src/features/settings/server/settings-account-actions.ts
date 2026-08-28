import { type Cookies, fail, redirect } from "@sveltejs/kit";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import type { SettingsActionInput } from "@/features/settings/server/settings-page-common";
import { requireSettingsUser } from "@/features/settings/server/settings-page-data";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { authApi } from "@/lib/auth/core";
import {
  applyAuthResponseCookies,
  linkAccountFromSvelteAction,
} from "@/lib/auth/svelte-auth-actions";
import { logServerActionError } from "@/lib/log/app-logger";
import { deleteOwnAccount } from "./account-deletion-service";
import { unlinkSettingsAccount } from "./settings-account-unlink";
import { authorizeRecentSettingsAction } from "./settings-recent-auth";

export async function unlinkSettingsAccountAction({
  locale,
  request,
  requestId,
  url,
}: SettingsActionInput & { requestId?: string }) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const recent = await authorizeRecentSettingsAction({
    action: "account_unlink",
    request,
    requestId,
    targetType: "account",
    userId: user.id,
  });
  if (!recent.ok) {
    return fail(403, {
      kind: "accounts",
      message: copy.settings.recentAuthRequired,
    });
  }
  const form = await request.formData();
  const provider = String(form.get("provider") ?? "");
  let result: Awaited<ReturnType<typeof unlinkSettingsAccount>>;
  try {
    result = await unlinkSettingsAccount(user.id, provider);
  } catch (error) {
    await fireAuditLog({
      action: "account_unlink",
      channel: "web",
      outcome: "failure",
      sessionId: recent.sessionId,
      subjectUserId: user.id,
      targetType: "account",
      userId: user.id,
      metadata: { provider },
      ...getAuditRequestMetadata(request, requestId),
    });
    throw error;
  }
  if (result === "last_account") {
    await fireAuditLog({
      action: "account_unlink",
      channel: "web",
      outcome: "denied",
      sessionId: recent.sessionId,
      subjectUserId: user.id,
      targetType: "account",
      userId: user.id,
      metadata: { provider, reason: "last_account" },
      ...getAuditRequestMetadata(request, requestId),
    });
    return fail(400, {
      kind: "accounts",
      message: copy.profile.cannotDisconnectLast,
    });
  }
  if (result === "not_linked") {
    await fireAuditLog({
      action: "account_unlink",
      channel: "web",
      outcome: "failure",
      sessionId: recent.sessionId,
      subjectUserId: user.id,
      targetType: "account",
      userId: user.id,
      metadata: { provider, reason: "not_linked" },
      ...getAuditRequestMetadata(request, requestId),
    });
    return fail(404, {
      kind: "accounts",
      message: copy.profile.accountNotLinked,
    });
  }
  await fireAuditLog({
    action: "account_unlink",
    channel: "web",
    sessionId: recent.sessionId,
    subjectUserId: user.id,
    targetType: "account",
    userId: user.id,
    metadata: { provider },
    ...getAuditRequestMetadata(request, requestId),
  });
  throw redirect(303, "/account/settings/accounts?message=AccountDisconnected");
}

export async function linkSettingsAccountAction({
  cookies,
  locale,
  request,
  requestId,
  url,
}: SettingsActionInput & { cookies: Cookies; requestId: string }) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const recent = await authorizeRecentSettingsAction({
    action: "account_link",
    request,
    requestId,
    targetType: "account",
    userId: user.id,
  });
  if (!recent.ok) {
    return fail(403, {
      kind: "accounts",
      message: copy.settings.recentAuthRequired,
    });
  }
  const form = await request.formData();
  const providerId = String(form.get("providerId") ?? "");
  try {
    const result = await linkAccountFromSvelteAction({
      providerId,
      callbackUrl: "/account/settings/accounts",
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
    logServerActionError("settings.account-link.failed", error, {
      action: "link-account",
      requestId,
      route: "/settings/accounts",
    });
    await fireAuditLog({
      action: "account_link",
      channel: "web",
      outcome: "failure",
      sessionId: recent.sessionId,
      subjectUserId: user.id,
      targetType: "account",
      userId: user.id,
      metadata: { provider: providerId },
      ...getAuditRequestMetadata(request, requestId),
    });
    return fail(400, {
      kind: "accounts",
      message: copy.profile.connectFailed,
    });
  }
}

export async function deleteSettingsAccountAction({
  cookies,
  locale,
  request,
  requestId,
  url,
}: SettingsActionInput & { cookies: Cookies; requestId?: string }) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const form = await request.formData();
  if (String(form.get("confirm") ?? "") !== "DELETE") {
    return fail(400, {
      kind: "danger",
      message: copy.profile.deleteConfirmInvalid,
    });
  }
  const recent = await authorizeRecentSettingsAction({
    action: "account_delete",
    request,
    requestId,
    targetType: "user",
    userId: user.id,
  });
  if (!recent.ok) {
    return fail(403, {
      kind: "danger",
      message: copy.settings.recentAuthRequired,
    });
  }
  const result = await deleteOwnAccount(user.id, {
    ...getAuditRequestMetadata(request, requestId),
    channel: "web",
    sessionId: recent.sessionId,
  });
  if (!result.ok) {
    return fail(400, {
      kind: "danger",
      message:
        result.reason === "cannot_remove_last_admin"
          ? copy.profile.deleteAccountFinalAdmin
          : copy.profile.deleteAccountErrorDescription,
    });
  }
  const response = await authApi.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  applyAuthResponseCookies(response.headers, cookies);
  throw redirect(303, "/");
}
