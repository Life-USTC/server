import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/better-auth-option-env", () => ({
  getBetterAuthOptionEnv: () => ({
    authEnv: {
      AUTH_GITHUB_ID: "test-github",
      AUTH_GITHUB_SECRET: "test-secret",
    },
    oidcIssuer: "https://issuer.example",
  }),
}));
vi.mock("@/lib/auth/auth-config", () => ({ allowDebugAuth: () => false }));

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: { $queryRaw: queryRawMock },
}));

describe("settings account unlink database boundary", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it.each(["last_account", "not_linked", "unlinked"] as const)(
    "returns the function status %s",
    async (status) => {
      queryRawMock.mockResolvedValue([{ status }]);
      const { unlinkSettingsAccount } = await import(
        "@/features/settings/server/settings-account-unlink"
      );

      await expect(unlinkSettingsAccount("user-1", "github")).resolves.toBe(
        status,
      );
      const [query] = queryRawMock.mock.calls[0];
      expect(query.values.slice(0, 3)).toEqual([
        "user-1",
        "provider",
        "github",
      ]);
      expect(JSON.parse(query.values[3])).toEqual({
        github: "local:oauth:github",
      });
      expect(query.sql).toContain("public.remove_sign_in_method");
    },
  );

  it("fails closed on an unexpected function response", async () => {
    queryRawMock.mockResolvedValue([{ status: "unexpected" }]);
    const { unlinkSettingsAccount } = await import(
      "@/features/settings/server/settings-account-unlink"
    );

    await expect(unlinkSettingsAccount("user-1", "github")).rejects.toThrow(
      "Unexpected sign-in method removal result",
    );
  });
});
