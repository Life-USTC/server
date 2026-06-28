import { describe, expect, it, vi } from "vitest";

const prismaAdapterMock = vi.hoisted(() => vi.fn(() => "adapter-result"));

vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: prismaAdapterMock,
}));

describe("createBetterAuthPrismaAdapter", () => {
  it("集中 Better Auth Prisma 适配器配置", async () => {
    const { createBetterAuthPrismaAdapter } = await import(
      "@/lib/auth/better-auth-prisma-adapter"
    );
    const prisma = {};

    expect(createBetterAuthPrismaAdapter(prisma as never)).toBe(
      "adapter-result",
    );
    expect(prismaAdapterMock).toHaveBeenCalledWith(prisma, {
      provider: "postgresql",
    });
  });
});
