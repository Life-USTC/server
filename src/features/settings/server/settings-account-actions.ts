import { type Cookies, fail, redirect } from "@sveltejs/kit";
import { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import type { SettingsActionInput } from "@/features/settings/server/settings-page-common";
import { requireSettingsUser } from "@/features/settings/server/settings-page-data";
import { authApi } from "@/lib/auth/core";
import {
  applyAuthResponseCookies,
  linkAccountFromSvelteAction,
} from "@/lib/auth/svelte-auth-actions";
import { prisma } from "@/lib/db/prisma";
import { deleteOwnAccount } from "./account-deletion-service";

export async function unlinkSettingsAccountAction({
  locale,
  request,
  url,
}: SettingsActionInput) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const form = await request.formData();
  const provider = String(form.get("provider") ?? "");
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true, provider: true },
  });
  if (accounts.length <= 1) {
    return fail(400, {
      kind: "accounts",
      message: copy.profile.cannotDisconnectLast,
    });
  }
  const account = accounts.find((item) => item.provider === provider);
  if (!account)
    return fail(404, {
      kind: "accounts",
      message: copy.profile.accountNotLinked,
    });

  await prisma.$transaction([
    prisma.account.delete({ where: { id: account.id } }),
    prisma.verifiedEmail.deleteMany({
      where: { userId: user.id, provider },
    }),
  ]);
  throw redirect(303, "/settings/accounts?message=AccountDisconnected");
}

export async function linkSettingsAccountAction({
  cookies,
  locale,
  request,
  url,
}: SettingsActionInput & { cookies: Cookies }) {
  const copy = getSettingsCopy(locale);
  await requireSettingsUser(request, url);
  const form = await request.formData();
  const providerId = String(form.get("providerId") ?? "");
  try {
    const result = await linkAccountFromSvelteAction({
      providerId,
      callbackUrl: "/settings/accounts",
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
  url,
}: SettingsActionInput & { cookies: Cookies }) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const form = await request.formData();
  if (String(form.get("confirm") ?? "") !== "DELETE") {
    return fail(400, {
      kind: "danger",
      message: copy.profile.deleteConfirmInvalid,
    });
  }
  const result = await deleteOwnAccount(user.id);
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
