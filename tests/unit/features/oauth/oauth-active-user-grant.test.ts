import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";

const { withAdapter, queryRaw } = vi.hoisted(() => ({
  withAdapter: vi.fn(),
  queryRaw: vi.fn(),
}));
vi.mock("@/lib/db/prisma-adapter", () => ({
  withRuntimeDatabaseAdapter: withAdapter,
}));

describe("active OAuth user grant reader", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    withAdapter
      .mockReset()
      .mockImplementation((_database, read) => read({ queryRaw }));
  });

  it("rejects missing identities before acquiring a connection", async () => {
    await expect(
      hasActiveOAuthUserGrant({ clientId: "", userId: "user-1" }),
    ).resolves.toBe(false);
    await expect(
      hasActiveOAuthUserGrant({ clientId: "client-1", userId: "" }),
    ).resolves.toBe(false);
    expect(withAdapter).not.toHaveBeenCalled();
  });

  it("uses the auth role and propagates database errors", async () => {
    queryRaw.mockRejectedValue(new Error("database unavailable"));
    await expect(
      hasActiveOAuthUserGrant({ clientId: "client-1", userId: "user-1" }),
    ).rejects.toThrow("database unavailable");
    expect(withAdapter).toHaveBeenCalledExactlyOnceWith(
      "auth",
      expect.any(Function),
    );
  });
});
