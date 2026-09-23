import { beforeEach, describe, expect, it, vi } from "vitest";

const { adapterFactoryMock, findOneMock, prismaAdapterMock } = vi.hoisted(
  () => {
    const findOne = vi.fn();
    const adapterFactory = vi.fn(() => ({
      id: "prisma",
      findOne,
    }));
    return {
      adapterFactoryMock: adapterFactory,
      findOneMock: findOne,
      prismaAdapterMock: vi.fn(() => adapterFactory),
    };
  },
);

vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: prismaAdapterMock,
}));

describe("createBetterAuthPrismaAdapter", () => {
  beforeEach(() => {
    adapterFactoryMock.mockClear();
    findOneMock.mockReset();
    prismaAdapterMock.mockClear();
  });

  it("集中 Better Auth Prisma 适配器配置", async () => {
    const { createBetterAuthPrismaAdapter } = await import(
      "@/lib/auth/better-auth-prisma-adapter"
    );
    const prisma = {};
    const createAdapter = createBetterAuthPrismaAdapter(prisma as never);
    const adapter = createAdapter({} as never);

    expect(adapter.id).toBe("prisma");
    expect(prismaAdapterMock).toHaveBeenCalledWith(prisma, {
      provider: "postgresql",
    });
    expect(adapterFactoryMock).toHaveBeenCalledTimes(1);
  });

  it("对 Provider 隐藏已撤销 refresh，阻止 client/user 级全删", async () => {
    const { createBetterAuthPrismaAdapter } = await import(
      "@/lib/auth/better-auth-prisma-adapter"
    );
    const adapter = createBetterAuthPrismaAdapter({} as never)({} as never);
    const lookup = {
      model: "oauthRefreshToken",
      where: [{ field: "token", value: "hashed-refresh" }],
    };
    findOneMock.mockResolvedValueOnce({
      id: "old-refresh",
      revoked: new Date(),
    });

    await expect(adapter.findOne(lookup)).resolves.toBeNull();
    expect(findOneMock).toHaveBeenCalledWith(lookup);
  });

  it("保留 active refresh 与其他模型的正常读取", async () => {
    const { createBetterAuthPrismaAdapter } = await import(
      "@/lib/auth/better-auth-prisma-adapter"
    );
    const adapter = createBetterAuthPrismaAdapter({} as never)({} as never);
    const active = { id: "active-refresh", revoked: null };
    const revokedAccess = { id: "access", revoked: new Date() };
    findOneMock
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(revokedAccess);

    await expect(
      adapter.findOne({
        model: "oauthRefreshToken",
        where: [{ field: "token", value: "active" }],
      }),
    ).resolves.toBe(active);
    await expect(
      adapter.findOne({
        model: "oauthAccessToken",
        where: [{ field: "token", value: "access" }],
      }),
    ).resolves.toBe(revokedAccess);
  });
});
