import { prisma } from "@/lib/db/prisma";
import {
  deleteStorageObject,
  getStorageObjectResponse,
  putStorageObject,
} from "@/lib/storage/r2-object";
import { getCloudflareImagesBinding } from "@/lib/adapters/cloudflare-runtime";

export const PROFILE_AVATAR_DIMENSION = 256;
export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_OUTPUT_TYPE = "image/webp";

const PROFILE_AVATAR_INPUT_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const AVATAR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProfileAvatarUploadFailure =
  | "empty"
  | "invalid_image"
  | "too_large"
  | "unavailable";

export class ProfileAvatarUploadError extends Error {
  constructor(readonly reason: ProfileAvatarUploadFailure) {
    super(`Profile avatar upload failed: ${reason}`);
    this.name = "ProfileAvatarUploadError";
  }
}

function avatarUrl(userId: string, avatarId: string) {
  return `/media/avatars/${encodeURIComponent(userId)}/${avatarId}.webp`;
}

function avatarKey(userId: string, avatarId: string) {
  return `avatars/${userId}/${avatarId}.webp`;
}

export async function processProfileAvatarUpload(input: {
  file: File;
  userId: string;
}) {
  if (input.file.size <= 0) {
    throw new ProfileAvatarUploadError("empty");
  }
  if (input.file.size > PROFILE_AVATAR_MAX_BYTES) {
    throw new ProfileAvatarUploadError("too_large");
  }
  if (!PROFILE_AVATAR_INPUT_TYPES.has(input.file.type.toLowerCase())) {
    throw new ProfileAvatarUploadError("invalid_image");
  }

  const images = getCloudflareImagesBinding();
  if (!images) {
    throw new ProfileAvatarUploadError("unavailable");
  }

  const avatarId = crypto.randomUUID();
  const key = avatarKey(input.userId, avatarId);
  try {
    const transformed = await images
      .input(input.file.stream())
      .transform({
        width: PROFILE_AVATAR_DIMENSION,
        height: PROFILE_AVATAR_DIMENSION,
        fit: "cover",
        gravity: "auto",
      })
      .output({
        format: PROFILE_AVATAR_OUTPUT_TYPE,
        quality: 85,
      });
    const response = transformed.response();
    if (!response.ok || !response.body) {
      throw new ProfileAvatarUploadError("invalid_image");
    }
    await putStorageObject({
      body: response.body,
      contentType: PROFILE_AVATAR_OUTPUT_TYPE,
      key,
    });
  } catch (error) {
    if (error instanceof ProfileAvatarUploadError) throw error;
    const code =
      error && typeof error === "object" && "code" in error
        ? Number(error.code)
        : null;
    throw new ProfileAvatarUploadError(
      code === 9412 ? "invalid_image" : "unavailable",
    );
  }

  return {
    key,
    url: avatarUrl(input.userId, avatarId),
  };
}

export async function deleteProcessedProfileAvatar(key: string) {
  await deleteStorageObject(key);
}

export async function getPublicProfileAvatar(input: {
  avatarId: string;
  userId: string;
}) {
  if (!AVATAR_ID_PATTERN.test(input.avatarId)) return null;
  const url = avatarUrl(input.userId, input.avatarId);
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { image: true, profilePictures: true },
  });
  if (!user || (user.image !== url && !user.profilePictures.includes(url))) {
    return null;
  }

  const response = await getStorageObjectResponse({
    contentDisposition: 'inline; filename="avatar.webp"',
    contentType: PROFILE_AVATAR_OUTPUT_TYPE,
    key: avatarKey(input.userId, input.avatarId),
  });
  if (!response) return null;
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return response;
}
