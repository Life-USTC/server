import type { Cookies } from "@sveltejs/kit";
import { fail, redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { authApi, getSessionFromHeaders } from "@/lib/auth/core";
import { applyAuthResponseCookies } from "@/lib/auth/svelte-auth-actions";
import { getWelcomeCopy } from "./welcome-page-copy";
import {
  isValidWelcomeUsername,
  parseWelcomeProfileForm,
} from "./welcome-profile-form";

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
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(303, buildSignInPageUrl("/welcome"));
  }

  const form = await request.formData();
  const { image, name, username } = parseWelcomeProfileForm(form);

  if (!name) {
    return fail(400, { message: copy.profile.nameRequired });
  }
  if (!isValidWelcomeUsername(username)) {
    return fail(400, {
      message: copy.profile.usernameInvalid,
    });
  }

  const { prisma } = await import("@/lib/db/prisma");
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, image: true, profilePictures: true },
  });
  if (!current) {
    return fail(404, { message: copy.profile.userNotFound });
  }
  if (
    image &&
    image !== current.image &&
    !current.profilePictures.includes(image)
  ) {
    return fail(400, { message: copy.profile.avatarInvalid });
  }

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing && existing.id !== session.user.id) {
    return fail(400, { message: copy.profile.usernameTaken });
  }

  const updateBody: {
    name: string;
    username: string;
    image?: string | null;
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
  throw redirect(303, "/");
}
