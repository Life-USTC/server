import { type Cookies, fail, redirect } from "@sveltejs/kit";
import type { SettingsActionInput } from "@/features/settings/lib/settings-page-common";
import { authApi } from "@/lib/auth/core";
import {
  applyAuthResponseCookies,
  linkAccountFromSvelteAction,
} from "@/lib/auth/svelte-auth-actions";
import { getSettingsCopy } from "@/lib/settings-copy";
import { requireSettingsUser } from "@/lib/settings-page-data";

export async function unlinkSettingsAccountAction({
  locale,
  request,
  url,
}: SettingsActionInput) {
  const copy = getSettingsCopy(locale);
  const user = await requireSettingsUser(request, url);
  const form = await request.formData();
  const provider = String(form.get("provider") ?? "");
  const { prisma } = await import("@/lib/db/prisma");
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
      callbackUrl: "/settings?tab=accounts",
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
  const { prisma } = await import("@/lib/db/prisma");
  await prisma.user.delete({ where: { id: user.id } });
  const response = await authApi.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  applyAuthResponseCookies(response.headers, cookies);
  throw redirect(303, "/");
}
