import { type Cookies, fail, redirect } from "@sveltejs/kit";
import type { SettingsActionInput } from "@/features/settings/lib/settings-page-common";
import {
  isValidSettingsUsername,
  parseSettingsProfileForm,
} from "@/features/settings/lib/settings-profile-form";
import { authApi } from "@/lib/auth/core";
import { applyAuthResponseCookies } from "@/lib/auth/svelte-auth-actions";
import { getSettingsCopy } from "@/lib/settings-copy";
import { requireSettingsUser } from "@/lib/settings-page-data";

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
  if (!name) {
    return fail(400, {
      kind: "profile",
      message: copy.profile.nameRequired,
    });
  }
  if (username && !isValidSettingsUsername(username)) {
    return fail(400, {
      kind: "profile",
      message: copy.profile.usernameInvalid,
    });
  }

  const { prisma } = await import("@/lib/db/prisma");
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, image: true, profilePictures: true },
  });
  if (!current)
    return fail(404, { kind: "profile", message: copy.common.userNotFound });
  if (
    image &&
    image !== current.image &&
    !current.profilePictures.includes(image)
  ) {
    return fail(400, {
      kind: "profile",
      message: copy.profile.avatarInvalid,
    });
  }

  if (username) {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      return fail(400, {
        kind: "profile",
        message: copy.profile.usernameTaken,
      });
    }
  }

  const updateBody: {
    image?: string | null;
    name: string;
    username: string | null;
  } = { name, username };
  if (image !== null && image !== current.image) {
    updateBody.image = image;
  }

  const response = await authApi.updateUser({
    body: updateBody,
    headers: request.headers,
    returnHeaders: true,
  });
  applyAuthResponseCookies(response.headers, cookies);
  throw redirect(303, "/settings/profile?message=Success");
}
