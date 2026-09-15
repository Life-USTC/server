import { beforeEach, describe, expect, it, vi } from "vitest";

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
      expect(query.values).toEqual(["user-1", "github"]);
    },
  );

  it("fails closed on an unexpected function response", async () => {
    queryRawMock.mockResolvedValue([{ status: "unexpected" }]);
    const { unlinkSettingsAccount } = await import(
      "@/features/settings/server/settings-account-unlink"
    );

    await expect(unlinkSettingsAccount("user-1", "github")).rejects.toThrow(
      "Unexpected settings account unlink result",
    );
  });
});
