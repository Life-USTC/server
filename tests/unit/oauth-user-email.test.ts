import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPlaceholderUserEmail,
  isPublishableUserEmail,
} from "@/lib/auth/oauth-user-email";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    verifiedEmail: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

describe("oauth user email helpers", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("detects local and fake placeholder emails", () => {
    expect(isPlaceholderUserEmail("oidc-1@users.local")).toBe(true);
    expect(isPlaceholderUserEmail("fakegid+x@example.com")).toBe(true);
    expect(isPublishableUserEmail("student@mail.ustc.edu.cn")).toBe(true);
  });

  it("prefers verified upstream email over @users.local for OAuth clients", async () => {
    findManyMock.mockResolvedValueOnce([
      { email: "student@mail.ustc.edu.cn", provider: "oidc" },
    ]);
    const { resolveOAuthUserEmail } = await import(
      "@/lib/auth/oauth-user-email-resolve"
    );

    await expect(
      resolveOAuthUserEmail({
        userId: "user-1",
        userEmail: "oidc-1@users.local",
        userEmailVerified: false,
      }),
    ).resolves.toEqual({
      email: "student@mail.ustc.edu.cn",
      emailVerified: true,
      source: "verified-email",
    });
  });

  it("returns null when only placeholder emails exist", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const { resolveOAuthUserEmail } = await import(
      "@/lib/auth/oauth-user-email-resolve"
    );

    await expect(
      resolveOAuthUserEmail({
        userId: "user-1",
        userEmail: "oidc-1@users.local",
        userEmailVerified: false,
      }),
    ).resolves.toBeNull();
  });
});
