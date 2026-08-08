import { beforeEach, describe, expect, it, vi } from "vitest";

const { authApiMock, isPrismaUniqueConstraintErrorMock, prismaMock } =
  vi.hoisted(() => ({
    authApiMock: {
      updateUser: vi.fn(),
    },
    isPrismaUniqueConstraintErrorMock: vi.fn(),
    prismaMock: {
      user: {
        findUnique: vi.fn(),
      },
    },
  }));

vi.mock("@/lib/auth/core", () => ({
  authApi: authApiMock,
}));

vi.mock("@/lib/db/prisma-errors", () => ({
  isPrismaUniqueConstraintError: isPrismaUniqueConstraintErrorMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

const profileInput = {
  headers: new Headers(),
  image: null,
  name: "Test User",
  userId: "user-1",
  username: "race-name",
};

describe("updateOwnProfile", () => {
  beforeEach(() => {
    authApiMock.updateUser.mockReset();
    isPrismaUniqueConstraintErrorMock.mockReset();
    isPrismaUniqueConstraintErrorMock.mockReturnValue(false);
    prismaMock.user.findUnique.mockReset();
    vi.resetModules();
  });

  it.each([
    [{ ...profileInput, name: "" }, "name_required"],
    [{ ...profileInput, username: "Invalid Name" }, "invalid_username"],
  ] as const)("rejects invalid profile fields", async (input, reason) => {
    const { updateOwnProfile } = await import(
      "@/features/profile/server/profile-update-service"
    );

    await expect(updateOwnProfile(input)).resolves.toEqual({
      ok: false,
      reason,
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a missing user", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const { updateOwnProfile } = await import(
      "@/features/profile/server/profile-update-service"
    );

    await expect(updateOwnProfile(profileInput)).resolves.toEqual({
      ok: false,
      reason: "user_not_found",
    });
  });

  it("rejects an avatar that is neither upstream nor server-processed", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      image: null,
      profilePictures: ["https://example.test/allowed.webp"],
    });
    const { updateOwnProfile } = await import(
      "@/features/profile/server/profile-update-service"
    );

    await expect(
      updateOwnProfile({
        ...profileInput,
        image: "https://attacker.example/avatar.webp",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "avatar_invalid",
    });
  });

  it("rejects a username owned by another user", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        image: null,
        profilePictures: [],
      })
      .mockResolvedValueOnce({ id: "user-2" });
    const { updateOwnProfile } = await import(
      "@/features/profile/server/profile-update-service"
    );

    await expect(updateOwnProfile(profileInput)).resolves.toEqual({
      ok: false,
      reason: "username_taken",
    });
  });

  it("accepts a server-processed avatar and returns refreshed auth headers", async () => {
    const headers = new Headers({ "set-cookie": "session=updated" });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        image: null,
        profilePictures: [],
      })
      .mockResolvedValueOnce(null);
    authApiMock.updateUser.mockResolvedValueOnce({ headers });
    const { updateOwnProfile } = await import(
      "@/features/profile/server/profile-update-service"
    );
    const image =
      "/media/avatars/user-1/123e4567-e89b-12d3-a456-426614174000.webp";

    await expect(
      updateOwnProfile({
        ...profileInput,
        image,
        trustedImageUrl: image,
      }),
    ).resolves.toEqual({ headers, ok: true });
    expect(authApiMock.updateUser).toHaveBeenCalledWith({
      body: {
        image,
        name: profileInput.name,
        username: profileInput.username,
      },
      headers: profileInput.headers,
      returnHeaders: true,
    });
  });

  it("将用户名唯一性竞争映射为 username_taken", async () => {
    const uniqueConflict = new Error("unique conflict");
    isPrismaUniqueConstraintErrorMock.mockReturnValueOnce(true);
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: "user-1",
        image: null,
        profilePictures: [],
      })
      .mockResolvedValueOnce(null);
    authApiMock.updateUser.mockRejectedValueOnce(uniqueConflict);
    const { updateOwnProfile } = await import(
      "@/features/profile/server/profile-update-service"
    );

    const result = await updateOwnProfile(profileInput);

    expect(result).toEqual({
      ok: false,
      reason: "username_taken",
    });
    expect(isPrismaUniqueConstraintErrorMock).toHaveBeenCalledWith(
      uniqueConflict,
    );
  });
});
