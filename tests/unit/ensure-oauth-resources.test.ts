import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetOAuthProviderResourceSeedForTests } from "@/features/oauth/server/ensure-oauth-resources.server";

const { findUniqueMock, createMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oauthResource: {
      findUnique: findUniqueMock,
      create: createMock,
    },
  },
}));

vi.mock("@/lib/oauth/resource-urls", () => ({
  getOAuthProviderValidAudiences: () => [
    "https://life.example/api/auth",
    "https://life.example/api/mcp",
  ],
}));

vi.mock("@/lib/oauth/scope-registry", () => ({
  OAUTH_PROVIDER_SCOPES: ["workspace.todo:read", "mcp:tools"],
}));

describe("ensureOAuthProviderResourcesSeeded", () => {
  beforeEach(() => {
    vi.resetModules();
    resetOAuthProviderResourceSeedForTests();
    findUniqueMock.mockReset();
    createMock.mockReset();
  });

  it("inserts missing oauthResource rows once per process", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "resource-1" });

    const { ensureOAuthProviderResourcesSeeded } = await import(
      "@/features/oauth/server/ensure-oauth-resources.server"
    );

    await ensureOAuthProviderResourcesSeeded();
    await ensureOAuthProviderResourcesSeeded();

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        identifier: "https://life.example/api/auth",
        allowedScopes: ["workspace.todo:read", "mcp:tools"],
      }),
    });
    expect(createMock).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        identifier: "https://life.example/api/mcp",
      }),
    });
  });

  it("skips identifiers that already exist", async () => {
    findUniqueMock.mockImplementation(async ({ where }) =>
      where.identifier === "https://life.example/api/auth"
        ? { id: "existing" }
        : null,
    );
    createMock.mockResolvedValue({ id: "resource-2" });

    const { ensureOAuthProviderResourcesSeeded } = await import(
      "@/features/oauth/server/ensure-oauth-resources.server"
    );

    await ensureOAuthProviderResourcesSeeded();

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "https://life.example/api/mcp",
      }),
    });
  });
});
