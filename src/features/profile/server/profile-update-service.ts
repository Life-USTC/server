import { authApi } from "@/lib/auth/core";
import { prisma } from "@/lib/db/prisma";
import { isValidProfileUsername } from "../lib/profile-username";

type ProfileUpdateInput = {
  headers: Headers;
  image: string | null;
  name: string;
  userId: string;
  username: string;
};

export type ProfileUpdateFailureReason =
  | "avatar_invalid"
  | "invalid_username"
  | "name_required"
  | "user_not_found"
  | "username_taken";

export type ProfileUpdateResult =
  | { headers: Headers; ok: true }
  | { ok: false; reason: ProfileUpdateFailureReason };

export async function updateOwnProfile(
  input: ProfileUpdateInput,
): Promise<ProfileUpdateResult> {
  if (!input.name) return { ok: false, reason: "name_required" };
  if (!isValidProfileUsername(input.username)) {
    return { ok: false, reason: "invalid_username" };
  }

  const current = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, image: true, profilePictures: true },
  });
  if (!current) return { ok: false, reason: "user_not_found" };
  if (
    input.image &&
    input.image !== current.image &&
    !current.profilePictures.includes(input.image)
  ) {
    return { ok: false, reason: "avatar_invalid" };
  }

  const existing = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });
  if (existing && existing.id !== input.userId) {
    return { ok: false, reason: "username_taken" };
  }

  const updateBody: {
    image?: string | null;
    name: string;
    username: string;
  } = { name: input.name, username: input.username };
  if (input.image !== null && input.image !== current.image) {
    updateBody.image = input.image;
  }

  const response = await authApi.updateUser({
    body: updateBody,
    headers: input.headers,
    returnHeaders: true,
  });

  return { headers: response.headers, ok: true };
}
