import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
} from "@/lib/auth/provider-ids";

const hashPasswordMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  account: {
    upsert: vi.fn(),
  },
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

describe("debug auth config", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("builds default debug provider configs", async () => {
    const { getDebugProviderConfig } = await import("@/lib/auth/debug-auth");

    expect(getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID)).toEqual({
      username: "dev-user",
      name: "Dev User",
      email: "dev-user@debug.local",
      password: "dev-debug-password",
      isAdmin: false,
      image: "https://api.dicebear.com/9.x/shapes/svg?seed=life-ustc-dev-user",
    });
    expect(getDebugProviderConfig(DEV_ADMIN_PROVIDER_ID)).toMatchObject({
      username: "dev-admin",
      name: "Dev Admin User",
      email: "dev-admin@debug.local",
      password: "dev-admin-password",
      isAdmin: true,
    });
  });

  it("trims and lowercases environment overrides", async () => {
    vi.stubEnv("DEV_DEBUG_USERNAME", "  Custom-User ");
    vi.stubEnv("DEV_DEBUG_NAME", " Custom User ");
    vi.stubEnv("DEV_DEBUG_EMAIL", " USER@Example.TEST ");
    vi.stubEnv("DEV_DEBUG_PASSWORD", " custom-password ");

    const { getDebugProviderConfig } = await import("@/lib/auth/debug-auth");

    expect(getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID)).toMatchObject({
      username: "custom-user",
      name: "Custom User",
      email: "user@example.test",
      password: "custom-password",
    });
  });

  it("requires explicit debug passwords for non-development E2E auth", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");

    const { getDebugProviderConfig } = await import("@/lib/auth/debug-auth");

    expect(() => getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID)).toThrow(
      "DEV_DEBUG_PASSWORD is required when E2E_DEBUG_AUTH=1 (non-development NODE_ENV)",
    );
  });
});

describe("ensureDebugCredentialUser", () => {
  const debugImage =
    "https://api.dicebear.com/9.x/shapes/svg?seed=life-ustc-dev-user";
  const debugUserUpdateData = {
    username: "dev-user",
    email: "dev-user@debug.local",
    emailVerified: true,
    name: "Dev User",
    image: debugImage,
    isAdmin: false,
    profilePictures: { set: [debugImage] },
  };

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("repairs a stale debug user matched by email", async () => {
    hashPasswordMock.mockResolvedValue("hashed-debug-password");
    prismaMock.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve("email" in where ? { id: "stale-user-id" } : null),
    );
    prismaMock.user.update.mockResolvedValue({ id: "stale-user-id" });

    const { ensureDebugCredentialUser } = await import("@/lib/auth/debug-auth");

    await ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "stale-user-id" },
      data: debugUserUpdateData,
      select: { id: true },
    });
    expect(prismaMock.account.upsert).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "credential",
          providerAccountId: "stale-user-id",
        },
      },
      update: {
        userId: "stale-user-id",
        type: "credential",
        provider: "credential",
        password: "hashed-debug-password",
      },
      create: {
        userId: "stale-user-id",
        type: "credential",
        provider: "credential",
        providerAccountId: "stale-user-id",
        password: "hashed-debug-password",
      },
    });
  });

  it("uses the username match when a separate stale row holds the debug email", async () => {
    hashPasswordMock.mockResolvedValue("hashed-debug-password");
    prismaMock.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(
        "username" in where ? { id: "seed-user-id" } : { id: "stale-user-id" },
      ),
    );
    prismaMock.user.update.mockResolvedValue({ id: "seed-user-id" });

    const { ensureDebugCredentialUser } = await import("@/lib/auth/debug-auth");

    await ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID);

    expect(prismaMock.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: "stale-user-id" },
      data: {
        email: "debug-auth-superseded-dev-debug-stale-user-id@debug.local",
      },
      select: { id: true },
    });
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: "seed-user-id" },
      data: debugUserUpdateData,
      select: { id: true },
    });
    expect(prismaMock.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerAccountId: {
            provider: "credential",
            providerAccountId: "seed-user-id",
          },
        },
      }),
    );
  });
});
