import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authAccountFindManyMock,
  baseUserFindUniqueMock,
  getSessionFromHeadersMock,
} = vi.hoisted(() => ({
  authAccountFindManyMock: vi.fn(),
  baseUserFindUniqueMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/features/oauth/server/user-authorizations.server", () => ({
  listUserOAuthAuthorizations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: baseUserFindUniqueMock },
  },
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    account: { findMany: authAccountFindManyMock },
  },
}));

describe("settings page RLS context", () => {
  beforeEach(() => {
    getSessionFromHeadersMock.mockReset().mockResolvedValue({
      user: { id: "user-1" },
    });
    authAccountFindManyMock.mockReset().mockResolvedValue([]);
    baseUserFindUniqueMock.mockReset().mockResolvedValue({
      id: "user-1",
      name: "User One",
      username: "user-one",
      email: "user-one@example.test",
      image: null,
      profilePictures: [],
    });
  });

  it("does not load the unused RLS-protected Todo count", async () => {
    const { getSettingsPageData } = await import(
      "@/features/settings/server/settings-page-data"
    );

    const result = await getSettingsPageData(
      new Request("https://life.example/account/settings/profile"),
      new URL("https://life.example/account/settings/profile"),
      "profile",
    );

    expect(baseUserFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        select: expect.not.objectContaining({
          _count: expect.anything(),
          accounts: expect.anything(),
        }),
      }),
    );
    expect(authAccountFindManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        createdAt: true,
      },
    });
    expect(result.user).not.toHaveProperty("counts");
  });
});
