import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findConsentMock,
  findVerificationTokenMock,
  resolveActiveGrantMock,
  updateVerificationTokenMock,
} = vi.hoisted(() => ({
  findConsentMock: vi.fn(),
  findVerificationTokenMock: vi.fn(),
  resolveActiveGrantMock: vi.fn(),
  updateVerificationTokenMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthConsent: {
      findFirst: findConsentMock,
    },
    verificationToken: {
      findFirst: findVerificationTokenMock,
      updateMany: updateVerificationTokenMock,
    },
  },
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  resolveActiveOAuthUserGrant: resolveActiveGrantMock,
}));

describe("OAuth authorization-code grant binding", () => {
  beforeEach(() => {
    findConsentMock.mockReset();
    findVerificationTokenMock.mockReset();
    resolveActiveGrantMock.mockReset();
    updateVerificationTokenMock.mockReset();
    findConsentMock.mockResolvedValue({ id: "consent-1" });
    findVerificationTokenMock.mockResolvedValue({
      id: "verification-1",
      token: JSON.stringify({
        query: {
          client_id: "client-1",
          scope: "profile todo:read",
        },
        sessionId: "session-1",
        type: "authorization_code",
        userId: "user-1",
      }),
    });
    resolveActiveGrantMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-1",
      kind: "consent",
    });
    updateVerificationTokenMock.mockResolvedValue({ count: 1 });
  });

  it("writes only the immutable expected generation into the authorization code", async () => {
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("code-1", "client-1", "grant-1"),
    ).resolves.toBe(true);

    expect(resolveActiveGrantMock).toHaveBeenNthCalledWith(1, {
      clientId: "client-1",
      grantId: "grant-1",
      requireGrantBinding: true,
      scopes: ["profile", "todo:read"],
      userId: "user-1",
    });
    const stored = JSON.parse(
      updateVerificationTokenMock.mock.calls[0]?.[0].data.token,
    );
    expect(stored.referenceId).toBe("grant-1");
    expect(resolveActiveGrantMock).toHaveBeenNthCalledWith(2, {
      clientId: "client-1",
      grantId: "grant-1",
      requireGrantBinding: true,
      scopes: ["profile", "todo:read"],
      userId: "user-1",
    });
  });

  it("binds a login continuation to the code user's current consent", async () => {
    resolveActiveGrantMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        consentId: "consent-1",
        grantId: "grant-1",
        kind: "consent",
      })
      .mockResolvedValueOnce({
        consentId: "consent-1",
        grantId: "grant-1",
        kind: "consent",
      });
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant(
        "code-1",
        "client-1",
        undefined,
        new Date("2026-07-20T00:00:01.000Z"),
      ),
    ).resolves.toBe(true);

    expect(resolveActiveGrantMock).toHaveBeenNthCalledWith(1, {
      clientId: "client-1",
      grantId: expect.any(String),
      requireGrantBinding: true,
      scopes: ["profile", "todo:read"],
      userId: "user-1",
    });
    expect(resolveActiveGrantMock).toHaveBeenNthCalledWith(2, {
      clientId: "client-1",
      scopes: ["profile", "todo:read"],
      userId: "user-1",
    });
    const stored = JSON.parse(
      updateVerificationTokenMock.mock.calls[0]?.[0].data.token,
    );
    expect(stored.referenceId).toBe("grant-1");
    expect(findConsentMock).toHaveBeenCalledWith({
      where: {
        clientId: "client-1",
        grantId: "grant-1",
        id: "consent-1",
        updatedAt: { lt: new Date("2026-07-20T00:00:01.000Z") },
        userId: "user-1",
      },
      select: { id: true },
    });
  });

  it("does not promote an old unbound code to a rotated consent", async () => {
    resolveActiveGrantMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      consentId: "consent-2",
      grantId: "grant-2",
      kind: "consent",
    });
    findConsentMock.mockResolvedValue(null);
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant(
        "old-code",
        "client-1",
        undefined,
        new Date("2026-07-20T00:00:01.000Z"),
      ),
    ).resolves.toBe(false);
    expect(updateVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("gives an unbound trusted code a recoverable grant generation", async () => {
    resolveActiveGrantMock.mockResolvedValue({ kind: "trusted" });
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("code-1", "client-1"),
    ).resolves.toBe(true);
    const stored = JSON.parse(
      updateVerificationTokenMock.mock.calls[0]?.[0].data.token,
    );
    expect(stored.referenceId).toEqual(expect.any(String));
    expect(resolveActiveGrantMock).toHaveBeenNthCalledWith(1, {
      clientId: "client-1",
      grantId: stored.referenceId,
      requireGrantBinding: true,
      scopes: ["profile", "todo:read"],
      userId: "user-1",
    });
    expect(resolveActiveGrantMock).toHaveBeenNthCalledWith(2, {
      clientId: "client-1",
      grantId: stored.referenceId,
      requireGrantBinding: true,
      scopes: ["profile", "todo:read"],
      userId: "user-1",
    });
  });

  it("never rebinds a code that already belongs to an old generation", async () => {
    findVerificationTokenMock.mockResolvedValue({
      id: "verification-1",
      token: JSON.stringify({
        query: { client_id: "client-1", scope: "profile" },
        referenceId: "old-grant",
        sessionId: "session-1",
        type: "authorization_code",
        userId: "user-1",
      }),
    });
    resolveActiveGrantMock.mockResolvedValue(null);
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("old-code", "client-1"),
    ).resolves.toBe(false);
    expect(resolveActiveGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      grantId: "old-grant",
      requireGrantBinding: true,
      scopes: ["profile"],
      userId: "user-1",
    });
    expect(updateVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("rejects a stored G1 code when the consent has rotated to G2", async () => {
    findVerificationTokenMock.mockResolvedValue({
      id: "verification-1",
      token: JSON.stringify({
        query: { client_id: "client-1", scope: "profile" },
        referenceId: "grant-1",
        type: "authorization_code",
        userId: "user-1",
      }),
    });
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("code-1", "client-1", "grant-2"),
    ).resolves.toBe(false);
    expect(resolveActiveGrantMock).not.toHaveBeenCalled();
    expect(updateVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("fails when G1 is revoked or replaced before the post-store check", async () => {
    resolveActiveGrantMock
      .mockResolvedValueOnce({
        consentId: "consent-1",
        grantId: "grant-1",
        kind: "consent",
      })
      .mockResolvedValueOnce(null);
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("code-1", "client-1", "grant-1"),
    ).resolves.toBe(false);
    expect(updateVerificationTokenMock).toHaveBeenCalledTimes(1);
  });

  it("fails when a concurrent accept wins the compare-and-set", async () => {
    updateVerificationTokenMock.mockResolvedValue({ count: 0 });
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("code-1", "client-1", "grant-1"),
    ).resolves.toBe(false);
    expect(resolveActiveGrantMock).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate authorization codes in a redirect", async () => {
    const { bindOAuthAuthorizationCodeRedirectToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeRedirectToActiveGrant(
        "https://client.example/callback?code=one&code=two",
        "client-1",
        "https://life.example/api/auth/oauth2/authorize",
      ),
    ).resolves.toBe(false);
    expect(findVerificationTokenMock).not.toHaveBeenCalled();
  });
});
