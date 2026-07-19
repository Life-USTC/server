import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findVerificationTokenMock,
  resolveActiveGrantMock,
  updateVerificationTokenMock,
} = vi.hoisted(() => ({
  findVerificationTokenMock: vi.fn(),
  resolveActiveGrantMock: vi.fn(),
  updateVerificationTokenMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
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
    findVerificationTokenMock.mockReset();
    resolveActiveGrantMock.mockReset();
    updateVerificationTokenMock.mockReset();
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

  it("fails closed for an unbound nontrusted code without an expected generation", async () => {
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("code-1", "client-1"),
    ).resolves.toBe(false);

    expect(resolveActiveGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      grantId: undefined,
      requireGrantBinding: true,
      scopes: ["profile", "todo:read"],
      userId: "user-1",
    });
    expect(updateVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("allows an unbound code only when the client is explicitly trusted", async () => {
    resolveActiveGrantMock.mockResolvedValue({ kind: "trusted" });
    const { bindOAuthAuthorizationCodeToActiveGrant } = await import(
      "@/features/oauth/server/oauth-authorization-code-grant.server"
    );

    await expect(
      bindOAuthAuthorizationCodeToActiveGrant("code-1", "client-1"),
    ).resolves.toBe(true);
    expect(updateVerificationTokenMock).not.toHaveBeenCalled();
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
