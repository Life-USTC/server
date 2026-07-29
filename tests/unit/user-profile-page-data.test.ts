import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildUserProfileContributions: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: mocks.findUnique } }),
}));

vi.mock("@/features/profile/server/user-profile-contributions", () => ({
  buildUserProfileContributions: mocks.buildUserProfileContributions,
}));

import { getPublicUserIdentityByIdentifier } from "@/features/profile/server/user-profile-page-data";

const identitySelect = {
  createdAt: true,
  id: true,
  image: true,
  name: true,
  username: true,
};

describe("公开用户身份读取", () => {
  beforeEach(() => {
    mocks.buildUserProfileContributions.mockReset();
    mocks.findUnique.mockReset();
  });

  it("用户名命中时只读取公开身份字段", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      id: "user-id",
      image: null,
      name: "User",
      username: "mixedcase",
    });

    await expect(
      getPublicUserIdentityByIdentifier(" MixedCase "),
    ).resolves.toEqual({
      createdAt: "2026-01-02T03:04:05.000Z",
      id: "user-id",
      image: null,
      name: "User",
      username: "mixedcase",
    });
    expect(mocks.findUnique).toHaveBeenCalledOnce();
    expect(mocks.findUnique).toHaveBeenCalledWith({
      select: identitySelect,
      where: { username: "mixedcase" },
    });
    expect(mocks.buildUserProfileContributions).not.toHaveBeenCalled();
  });

  it("用户名未命中后才按原始 ID 回退", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      id: "CaseSensitiveId",
      image: null,
      name: "User",
      username: null,
    });

    await expect(
      getPublicUserIdentityByIdentifier(" CaseSensitiveId "),
    ).resolves.toMatchObject({ id: "CaseSensitiveId" });
    expect(mocks.findUnique).toHaveBeenNthCalledWith(1, {
      select: identitySelect,
      where: { username: "casesensitiveid" },
    });
    expect(mocks.findUnique).toHaveBeenNthCalledWith(2, {
      select: identitySelect,
      where: { id: "CaseSensitiveId" },
    });
    expect(mocks.buildUserProfileContributions).not.toHaveBeenCalled();
  });

  it("空白或两种查找均未命中时返回 null", async () => {
    await expect(getPublicUserIdentityByIdentifier("   ")).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();

    mocks.findUnique.mockResolvedValue(null);
    await expect(
      getPublicUserIdentityByIdentifier("missing"),
    ).resolves.toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
    expect(mocks.buildUserProfileContributions).not.toHaveBeenCalled();
  });
});
