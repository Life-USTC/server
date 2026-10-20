import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  adapterFactoryMock,
  createMock,
  updateMock,
  findOneMock,
  prismaAdapterMock,
} = vi.hoisted(() => {
  const findOne = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const adapterFactory = vi.fn(() => ({
    id: "prisma",
    findOne,
    create,
    update,
    transaction: vi.fn(
      async (
        callback: (tx: {
          id: string;
          findOne: typeof findOne;
        }) => Promise<unknown>,
      ) => callback({ id: "prisma", findOne }),
    ),
  }));
  return {
    adapterFactoryMock: adapterFactory,
    findOneMock: findOne,
    createMock: create,
    updateMock: update,
    prismaAdapterMock: vi.fn(() => adapterFactory),
  };
});

vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: prismaAdapterMock,
}));

describe("createBetterAuthPrismaAdapter", () => {
  beforeEach(() => {
    adapterFactoryMock.mockClear();
    findOneMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
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
      transaction: true,
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

  it.each([
    {
      clientDiscoveryId: "cimd",
      dpopBoundAccessTokens: true,
      grantTypes: ["authorization_code"],
    },
    {
      clientDiscoveryId: "cimd",
      grantTypes: ["urn:ietf:params:oauth:grant-type:device_code"],
    },
    { clientDiscoveryId: "cimd", grantTypes: ["client_credentials"] },
  ])(
    "rejects invalid CIMD admission before a transactional create: %j",
    async (data) => {
      const { createBetterAuthPrismaAdapter } = await import(
        "@/lib/auth/better-auth-prisma-adapter"
      );
      const prisma = {
        $transaction: async (callback: (client: object) => Promise<unknown>) =>
          callback({}),
      };
      const adapter = createBetterAuthPrismaAdapter(prisma as never)(
        {} as never,
      );
      await expect(
        adapter.transaction((tx) => tx.create({ model: "OAuthClient", data })),
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { error: "invalid_client" },
      });
      expect(createMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid CIMD refresh before updating the existing client", async () => {
    const { createBetterAuthPrismaAdapter } = await import(
      "@/lib/auth/better-auth-prisma-adapter"
    );
    const adapter = createBetterAuthPrismaAdapter({} as never)({} as never);
    findOneMock.mockResolvedValue({
      clientDiscoveryId: "cimd",
      grantTypes: ["authorization_code"],
    });
    await expect(
      adapter.update({
        model: "OAuthClient",
        where: [
          { field: "clientId", value: "https://client.example/metadata.json" },
        ],
        update: { grantTypes: ["client_credentials"] },
      }),
    ).rejects.toMatchObject({
      body: { error: "invalid_client" },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("preserves public device clients and valid CIMD registrations", async () => {
    const { createBetterAuthPrismaAdapter } = await import(
      "@/lib/auth/better-auth-prisma-adapter"
    );
    const adapter = createBetterAuthPrismaAdapter({} as never)({} as never);
    for (const data of [
      {
        clientDiscoveryId: null,
        grantTypes: ["urn:ietf:params:oauth:grant-type:device_code"],
      },
      {
        clientDiscoveryId: "cimd",
        grantTypes: ["authorization_code", "refresh_token"],
      },
    ]) {
      await adapter.create({ model: "OAuthClient", data });
      expect(createMock).toHaveBeenLastCalledWith({
        model: "OAuthClient",
        data,
      });
    }
  });

  it("persists only the application's supported CIMD grants", async () => {
    const { createBetterAuthPrismaAdapter } = await import(
      "@/lib/auth/better-auth-prisma-adapter"
    );
    const adapter = createBetterAuthPrismaAdapter({} as never)({} as never);
    await adapter.create({
      model: "OAuthClient",
      data: {
        clientDiscoveryId: "cimd",
        grantTypes: [
          "authorization_code",
          "refresh_token",
          "urn:ietf:params:oauth:grant-type:device_code",
        ],
      },
    });
    expect(createMock).toHaveBeenCalledWith({
      model: "OAuthClient",
      data: {
        clientDiscoveryId: "cimd",
        grantTypes: ["authorization_code", "refresh_token"],
      },
    });
  });
});

it("preserves revoked refresh-token filtering in transaction adapters", async () => {
  const { createBetterAuthPrismaAdapter } = await import(
    "@/lib/auth/better-auth-prisma-adapter"
  );
  const client = {};
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: object) => Promise<unknown>) =>
      callback(client),
    ),
  };
  const adapter = createBetterAuthPrismaAdapter(prisma as never)({} as never);
  findOneMock.mockResolvedValue({ id: "revoked", revoked: new Date() });
  await expect(
    adapter.transaction((tx) =>
      tx.findOne({
        model: "oauthRefreshToken",
        where: [{ field: "token", value: "revoked-token" }],
      }),
    ),
  ).resolves.toBeNull();
  expect(prismaAdapterMock).toHaveBeenLastCalledWith(client, {
    provider: "postgresql",
    transaction: false,
  });
});
