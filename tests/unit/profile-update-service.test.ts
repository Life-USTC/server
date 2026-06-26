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

  it("maps username uniqueness races to username_taken", async () => {
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
