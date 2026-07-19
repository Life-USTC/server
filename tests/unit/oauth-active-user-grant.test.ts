import { beforeEach, describe, expect, it, vi } from "vitest";

const clientFindUniqueMock = vi.fn();
const userFindUniqueMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthClient: {
      findUnique: clientFindUniqueMock,
    },
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

describe("active OAuth user grant", () => {
  beforeEach(() => {
    clientFindUniqueMock.mockReset();
    userFindUniqueMock.mockReset();
  });

  it("accepts an enabled client with a current-user consent", async () => {
    clientFindUniqueMock.mockResolvedValue({
      consents: [{ id: "consent-1" }],
      disabled: false,
      skipConsent: false,
    });
    const { hasActiveOAuthUserGrant } = await import(
      "@/lib/oauth/active-user-grant"
    );

    await expect(
      hasActiveOAuthUserGrant({
        clientId: "client-1",
        userId: "user-1",
      }),
    ).resolves.toBe(true);
    expect(clientFindUniqueMock).toHaveBeenCalledWith({
      where: { clientId: "client-1" },
      select: expect.objectContaining({
        consents: expect.objectContaining({
          where: { userId: "user-1" },
          take: 1,
        }),
      }),
    });
  });

  it.each([
    null,
    { consents: [{ id: "consent-1" }], disabled: true, skipConsent: false },
    { consents: [], disabled: false, skipConsent: false },
  ])("rejects a missing, disabled, or unconsented client", async (client) => {
    clientFindUniqueMock.mockResolvedValue(client);
    const { hasActiveOAuthUserGrant } = await import(
      "@/lib/oauth/active-user-grant"
    );

    await expect(
      hasActiveOAuthUserGrant({
        clientId: "client-1",
        userId: "user-1",
      }),
    ).resolves.toBe(false);
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("allows an enabled skipConsent client only for an existing user", async () => {
    clientFindUniqueMock.mockResolvedValue({
      consents: [],
      disabled: false,
      skipConsent: true,
    });
    userFindUniqueMock
      .mockResolvedValueOnce({ id: "user-1" })
      .mockResolvedValueOnce(null);
    const { hasActiveOAuthUserGrant } = await import(
      "@/lib/oauth/active-user-grant"
    );

    await expect(
      hasActiveOAuthUserGrant({
        clientId: "trusted-client",
        userId: "user-1",
      }),
    ).resolves.toBe(true);
    await expect(
      hasActiveOAuthUserGrant({
        clientId: "trusted-client",
        userId: "deleted-user",
      }),
    ).resolves.toBe(false);
  });

  it("fails closed when the grant lookup fails", async () => {
    clientFindUniqueMock.mockRejectedValue(new Error("database unavailable"));
    const { hasActiveOAuthUserGrant } = await import(
      "@/lib/oauth/active-user-grant"
    );

    await expect(
      hasActiveOAuthUserGrant({
        clientId: "client-1",
        userId: "user-1",
      }),
    ).rejects.toThrow("database unavailable");
  });

  it("rejects missing JWT grant identities without querying", async () => {
    const { hasActiveOAuthUserGrant } = await import(
      "@/lib/oauth/active-user-grant"
    );

    await expect(
      hasActiveOAuthUserGrant({ clientId: "", userId: "user-1" }),
    ).resolves.toBe(false);
    await expect(
      hasActiveOAuthUserGrant({ clientId: "client-1", userId: "" }),
    ).resolves.toBe(false);
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
  });
});
