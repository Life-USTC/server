import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteStorageObjectMock,
  getImagesBindingMock,
  getStorageObjectResponseMock,
  putStorageObjectMock,
  userFindUniqueMock,
} = vi.hoisted(() => ({
  deleteStorageObjectMock: vi.fn(),
  getImagesBindingMock: vi.fn(),
  getStorageObjectResponseMock: vi.fn(),
  putStorageObjectMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  getCloudflareImagesBinding: getImagesBindingMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: deleteStorageObjectMock,
  getStorageObjectResponse: getStorageObjectResponseMock,
  putStorageObject: putStorageObjectMock,
}));

import {
  getPublicProfileAvatar,
  PROFILE_AVATAR_MAX_BYTES,
  processProfileAvatarUpload,
} from "@/features/profile/server/profile-avatar-service";

describe("profile avatar service", () => {
  beforeEach(() => {
    deleteStorageObjectMock.mockReset();
    getImagesBindingMock.mockReset();
    getStorageObjectResponseMock.mockReset();
    putStorageObjectMock.mockReset();
    userFindUniqueMock.mockReset();
    vi.restoreAllMocks();
  });

  it("auto-crops an uploaded image and stores a 256px WebP in R2", async () => {
    const response = new Response("transformed", {
      headers: { "Content-Type": "image/webp" },
    });
    const output = vi.fn().mockResolvedValue({
      response: () => response,
    });
    const transform = vi.fn().mockReturnValue({ output });
    const input = vi.fn().mockReturnValue({ transform });
    getImagesBindingMock.mockReturnValue({ input });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "123e4567-e89b-12d3-a456-426614174000",
    );

    const result = await processProfileAvatarUpload({
      file: new File(["avatar"], "avatar.png", { type: "image/png" }),
      userId: "user-1",
    });

    expect(transform).toHaveBeenCalledWith({
      width: 256,
      height: 256,
      fit: "cover",
      gravity: "auto",
    });
    expect(output).toHaveBeenCalledWith({
      format: "image/webp",
      quality: 85,
    });
    expect(putStorageObjectMock).toHaveBeenCalledWith({
      body: response.body,
      contentType: "image/webp",
      key: "avatars/user-1/123e4567-e89b-12d3-a456-426614174000.webp",
    });
    expect(result).toEqual({
      key: "avatars/user-1/123e4567-e89b-12d3-a456-426614174000.webp",
      url: "/media/avatars/user-1/123e4567-e89b-12d3-a456-426614174000.webp",
    });
  });

  it.each([
    [new File([], "empty.png", { type: "image/png" }), "empty"],
    [new File(["text"], "avatar.txt", { type: "text/plain" }), "invalid_image"],
    [
      new File([new Uint8Array(PROFILE_AVATAR_MAX_BYTES + 1)], "large.png", {
        type: "image/png",
      }),
      "too_large",
    ],
  ] as const)("rejects invalid uploads", async (file, reason) => {
    await expect(
      processProfileAvatarUpload({ file, userId: "user-1" }),
    ).rejects.toMatchObject({ reason });
    expect(putStorageObjectMock).not.toHaveBeenCalled();
  });

  it("serves only avatar objects referenced by the owning profile", async () => {
    const storedResponse = new Response("avatar");
    userFindUniqueMock.mockResolvedValue({
      image: "/media/avatars/user-1/123e4567-e89b-12d3-a456-426614174000.webp",
      profilePictures: [],
    });
    getStorageObjectResponseMock.mockResolvedValue(storedResponse);

    const response = await getPublicProfileAvatar({
      avatarId: "123e4567-e89b-12d3-a456-426614174000",
      userId: "user-1",
    });

    expect(response?.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(getStorageObjectResponseMock).toHaveBeenCalledWith({
      contentDisposition: 'inline; filename="avatar.webp"',
      contentType: "image/webp",
      key: "avatars/user-1/123e4567-e89b-12d3-a456-426614174000.webp",
    });

    userFindUniqueMock.mockResolvedValue({
      image: "https://example.com/upstream.png",
      profilePictures: [],
    });
    await expect(
      getPublicProfileAvatar({
        avatarId: "123e4567-e89b-12d3-a456-426614174000",
        userId: "user-1",
      }),
    ).resolves.toBeNull();
  });
});
