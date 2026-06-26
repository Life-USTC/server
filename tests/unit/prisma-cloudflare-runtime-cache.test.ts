import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createBasePrismaMock,
  createdClients,
  localizedNamesExtensionMock,
  resetClientMocks,
} = vi.hoisted(() => {
  type MockClient = {
    $extends: ReturnType<typeof vi.fn>;
    $on: ReturnType<typeof vi.fn>;
    id: number;
    user: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  let nextClientId = 0;
  const createdClients: MockClient[] = [];
  const localizedNamesExtensionMock = vi.fn((locale: string) => ({ locale }));
  const createBasePrismaMock = vi.fn(() => {
    const id = ++nextClientId;
    const client: MockClient = {
      $extends: vi.fn((extension: { locale: string }) => ({
        baseClientId: id,
        extension,
      })),
      $on: vi.fn(),
      id,
      user: {
        findMany: vi.fn(() => [`user-${id}`]),
      },
    };
    createdClients.push(client);
    return client;
  });

  return {
    createBasePrismaMock,
    createdClients,
    localizedNamesExtensionMock,
    resetClientMocks: () => {
      nextClientId = 0;
      createdClients.length = 0;
      createBasePrismaMock.mockClear();
      localizedNamesExtensionMock.mockClear();
    },
  };
});

vi.mock("@/lib/db/prisma-localized-names", () => ({
  localizedNamesExtension: localizedNamesExtensionMock,
}));

vi.mock("@/lib/db/prisma-query-events", () => ({
  createBasePrisma: createBasePrismaMock,
  logPrismaQuery: vi.fn(),
}));

vi.mock("@/lib/db/prisma-query-logging", () => ({
  shouldEnablePrismaQueryLogging: vi.fn(() => false),
}));

async function loadRuntimePrisma() {
  const runtimeEnv = await import("@/lib/cloudflare/runtime-env");
  const prismaModule = await import("@/lib/db/prisma");
  return { ...runtimeEnv, ...prismaModule };
}

function clearGlobalPrismaState() {
  const globalState = globalThis as typeof globalThis & {
    __lifeUstcCloudflareRuntimeEnv?: unknown;
    prisma?: unknown;
    prismaQueryLoggerAttached?: unknown;
  };

  delete globalState.__lifeUstcCloudflareRuntimeEnv;
  delete globalState.prisma;
  delete globalState.prismaQueryLoggerAttached;
}

function getBaseClientId(value: unknown) {
  if (!value || typeof value !== "object" || !("baseClientId" in value)) {
    throw new Error("Expected mocked extended Prisma client");
  }

  const { baseClientId } = value;
  if (typeof baseClientId !== "number") {
    throw new Error("Expected mocked extended Prisma client id");
  }

  return baseClientId;
}

describe("Cloudflare Prisma runtime cache", () => {
  afterEach(() => {
    clearGlobalPrismaState();
    resetClientMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("reuses the base client and localized extensions within one runtime context", async () => {
    const { getPrisma, prisma, runWithCloudflareRuntimeEnv } =
      await loadRuntimePrisma();

    await runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: {
          connectionString: "postgresql://worker:worker@localhost:5432/one",
        },
      },
      async () => {
        expect(prisma.user).toBe(prisma.user);
        expect(createBasePrismaMock).toHaveBeenCalledTimes(1);

        const zhFirst = getPrisma("zh-cn");
        const zhSecond = getPrisma("zh-cn");
        const en = getPrisma("en-us");

        expect(zhSecond).toBe(zhFirst);
        expect(en).not.toBe(zhFirst);
        expect(getBaseClientId(zhFirst)).toBe(1);
        expect(getBaseClientId(en)).toBe(1);
      },
    );

    expect(createBasePrismaMock).toHaveBeenCalledTimes(1);
    expect(createdClients).toHaveLength(1);
    expect(createdClients[0].$extends).toHaveBeenCalledTimes(2);
    expect(localizedNamesExtensionMock).toHaveBeenCalledTimes(2);
  });

  it("does not share Cloudflare clients across distinct runtime contexts", async () => {
    const { getPrisma, prisma, runWithCloudflareRuntimeEnv } =
      await loadRuntimePrisma();

    const first = await runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: {
          connectionString: "postgresql://worker:worker@localhost:5432/one",
        },
      },
      async () => ({
        localized: getPrisma("zh-cn"),
        user: prisma.user,
      }),
    );
    const second = await runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: {
          connectionString: "postgresql://worker:worker@localhost:5432/two",
        },
      },
      async () => ({
        localized: getPrisma("zh-cn"),
        user: prisma.user,
      }),
    );

    expect(first.user).not.toBe(second.user);
    expect(first.localized).not.toBe(second.localized);
    expect(getBaseClientId(first.localized)).toBe(1);
    expect(getBaseClientId(second.localized)).toBe(2);
    expect(createBasePrismaMock).toHaveBeenCalledTimes(2);
  });

  it("keeps non-Cloudflare runtime access on the singleton path", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const { getPrisma, prisma } = await loadRuntimePrisma();

    expect(prisma.user).toBe(prisma.user);
    const zhFirst = getPrisma("zh-cn");
    const zhSecond = getPrisma("zh-cn");

    expect(zhSecond).toBe(zhFirst);
    expect(createBasePrismaMock).toHaveBeenCalledTimes(1);
  });
});
