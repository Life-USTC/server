import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
} from "@/lib/auth/provider-ids";

const hashPasswordMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  account: { upsert: vi.fn() },
  user: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

describe("debug 认证配置", () => {
  beforeEach(() => {
    hashPasswordMock.mockResolvedValue("hashed-debug-password");
    prismaMock.account.upsert.mockResolvedValue({});
    prismaMock.user.create.mockResolvedValue({ id: "created-user" });
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.update.mockResolvedValue({ id: "updated-user" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("构建默认 debug 提供者配置", async () => {
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

  it("对环境变量覆盖值进行修剪并小写化", async () => {
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

  it("非开发环境 E2E 认证需要显式 debug 密码", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");

    const { getDebugProviderConfig } = await import("@/lib/auth/debug-auth");

    expect(() => getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID)).toThrow(
      "DEV_DEBUG_PASSWORD is required when E2E_DEBUG_AUTH=1 (non-development NODE_ENV)",
    );
  });

  it("补全匹配的过期 debug 用户", async () => {
    const { ensureDebugCredentialUser, getDebugProviderConfig } = await import(
      "@/lib/auth/debug-auth"
    );
    const config = getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "stale-debug-user",
        username: null,
        email: config.email,
        image: null,
        profilePictures: [],
      },
    ]);

    await ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "stale-debug-user" },
      data: {
        username: config.username,
        email: config.email,
        emailVerified: true,
        name: config.name,
        isAdmin: config.isAdmin,
        image: config.image,
        profilePictures: { set: [config.image] },
      },
      select: { id: true },
    });
    expect(prismaMock.account.upsert).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "credential",
          providerAccountId: "updated-user",
        },
      },
      update: {
        userId: "updated-user",
        type: "credential",
        provider: "credential",
        password: "hashed-debug-password",
      },
      create: {
        userId: "updated-user",
        type: "credential",
        provider: "credential",
        providerAccountId: "updated-user",
        password: "hashed-debug-password",
      },
    });
  });

  it("优先使用用户名身份并中和重复的 debug 邮箱用户", async () => {
    const { ensureDebugCredentialUser, getDebugProviderConfig } = await import(
      "@/lib/auth/debug-auth"
    );
    const config = getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "canonical-debug-user",
        username: config.username,
        email: `${config.username}@users.local`,
        image: "https://example.test/existing-avatar.svg",
        profilePictures: ["https://example.test/existing-avatar.svg"],
      },
      {
        id: "stale-email-user",
        username: null,
        email: config.email,
        image: null,
        profilePictures: [],
      },
    ]);

    await ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID);

    expect(prismaMock.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: "stale-email-user" },
      data: {
        username: null,
        email: "debug-auth-stale-stale-email-user@debug.local",
      },
    });
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: "canonical-debug-user" },
      data: {
        username: config.username,
        email: config.email,
        emailVerified: true,
        name: config.name,
        isAdmin: config.isAdmin,
        image: "https://example.test/existing-avatar.svg",
      },
      select: { id: true },
    });
  });
});
