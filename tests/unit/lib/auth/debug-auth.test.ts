import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
} from "@/lib/auth/provider-ids";

const prismaMock = vi.hoisted(() => ({
  account: { findUnique: vi.fn(), upsert: vi.fn() },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: prismaMock,
}));

describe("debug 认证配置", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "seeded-user",
      username: "dev-user",
      isAdmin: false,
      profilePictures: ["https://example.test/seeded-avatar.svg"],
    });
    prismaMock.account.findUnique.mockResolvedValue({
      id: "seeded-credential",
    });
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

  it("只读取预置的 debug 用户和 credential，不写 auth 数据库", async () => {
    const { ensureDebugCredentialUser, getDebugProviderConfig } = await import(
      "@/lib/auth/debug-auth"
    );
    const config = getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID);

    await expect(
      ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID),
    ).resolves.toBe("seeded-user");

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: config.email },
      select: { id: true },
    });
    expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
      where: {
        issuer_providerAccountId: {
          issuer: "local:credential",
          providerAccountId: "seeded-user",
        },
      },
      select: { id: true },
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.account.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.account.upsert).not.toHaveBeenCalled();
  });

  it("预置用户缺失时明确要求先执行 seed", async () => {
    const { ensureDebugCredentialUser, getDebugProviderConfig } = await import(
      "@/lib/auth/debug-auth"
    );
    const config = getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID),
    ).rejects.toThrow(
      `Debug auth user ${DEV_DEBUG_PROVIDER_ID} (${config.email}) is missing; run the configured database seed`,
    );
    expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
  });

  it("预置 credential 缺失时明确要求先执行 seed", async () => {
    const { ensureDebugCredentialUser } = await import("@/lib/auth/debug-auth");
    prismaMock.account.findUnique.mockResolvedValue(null);

    await expect(
      ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID),
    ).rejects.toThrow(
      `Debug auth credential ${DEV_DEBUG_PROVIDER_ID} is missing; run the configured database seed`,
    );
  });

  it("允许用户资料和管理员标记发生变化且不重置属性", async () => {
    const { ensureDebugCredentialUser } = await import("@/lib/auth/debug-auth");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "existing-user",
      username: "user-chosen-name",
      isAdmin: true,
      profilePictures: [],
    });

    await expect(
      ensureDebugCredentialUser(DEV_DEBUG_PROVIDER_ID),
    ).resolves.toBe("existing-user");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.account.upsert).not.toHaveBeenCalled();
  });
});
