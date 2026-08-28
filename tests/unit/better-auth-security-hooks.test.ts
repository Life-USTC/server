import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fireAuditLogMock } = vi.hoisted(() => ({
  fireAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: fireAuditLogMock,
  getAuditRequestMetadata: vi.fn(() => ({ requestId: "request-1" })),
}));

import {
  betterAuthSecurityDatabaseHooks,
  betterAuthSecurityHooks,
  enforceBetterAuthRecentSession,
} from "@/lib/auth/better-auth-security-hooks";

function endpointContext(
  path: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    body: {},
    context: {
      returned: undefined,
      session: {
        session: { id: "session-1" },
        user: { id: "user-1" },
      },
    },
    headers: new Headers(),
    path,
    ...overrides,
  } as never;
}

describe("Better Auth security audit hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
    fireAuditLogMock.mockReset();
    fireAuditLogMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records committed session creation without copying its token", async () => {
    await betterAuthSecurityDatabaseHooks.session?.create?.after?.(
      {
        createdAt: new Date(),
        expiresAt: new Date(),
        id: "session-1",
        ipAddress: null,
        token: "must-not-be-audited",
        updatedAt: new Date(),
        userAgent: null,
        userId: "user-1",
      },
      endpointContext("/passkey/verify-authentication"),
    );

    expect(fireAuditLogMock).toHaveBeenCalledWith({
      action: "account_sign_in",
      channel: "auth",
      metadata: { authMethod: "passkey" },
      requestId: "request-1",
      sessionId: "session-1",
      subjectUserId: "user-1",
      targetId: "session-1",
      targetType: "session",
      userId: "user-1",
    });
    expect(JSON.stringify(fireAuditLogMock.mock.calls)).not.toContain(
      "must-not-be-audited",
    );
  });

  it("ignores session rows created outside a sign-in endpoint", async () => {
    await betterAuthSecurityDatabaseHooks.session?.create?.after?.(
      {
        createdAt: new Date(),
        expiresAt: new Date(),
        id: "session-1",
        ipAddress: null,
        token: "secret",
        updatedAt: new Date(),
        userAgent: null,
        userId: "user-1",
      },
      endpointContext("/change-password"),
    );

    expect(fireAuditLogMock).not.toHaveBeenCalled();
  });

  it("classifies set-password account creation as a credential update", async () => {
    await betterAuthSecurityDatabaseHooks.account?.create?.after?.(
      {
        accessToken: null,
        accessTokenExpiresAt: null,
        accountId: "user@example.test",
        createdAt: new Date(),
        id: "credential-account-1",
        idToken: null,
        issuer: "local",
        password: "must-not-be-audited",
        providerId: "credential",
        refreshToken: null,
        refreshTokenExpiresAt: null,
        scope: null,
        updatedAt: new Date(),
        userId: "user-1",
      },
      endpointContext("/set-password"),
    );

    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account_credential_update",
        metadata: { changedFields: ["password"] },
      }),
    );
    const serialized = JSON.stringify(fireAuditLogMock.mock.calls);
    expect(serialized).not.toContain("must-not-be-audited");
    expect(serialized).not.toContain("account_link");
  });

  it("never turns a committed database mutation into a false failure", async () => {
    fireAuditLogMock.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      betterAuthSecurityDatabaseHooks.session?.create?.after?.(
        {
          createdAt: new Date(),
          expiresAt: new Date(),
          id: "session-1",
          ipAddress: null,
          token: "secret",
          updatedAt: new Date(),
          userAgent: null,
          userId: "user-1",
        },
        endpointContext("/sign-in/email"),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["unauthenticated", null, "UNAUTHORIZED"],
    [
      "stale",
      {
        session: {
          createdAt: new Date("2026-08-15T11:44:00.000Z"),
          id: "session-1",
        },
        user: { id: "user-1" },
      },
      "SESSION_NOT_FRESH",
    ],
  ])(
    "audits and rejects a %s authoritative session",
    async (_case, session, code) => {
      await expect(
        enforceBetterAuthRecentSession(
          endpointContext("/passkey/delete-passkey"),
          async () => session as never,
        ),
      ).rejects.toMatchObject({ body: { code } });
      expect(fireAuditLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "account_passkey_delete",
          outcome: "denied",
          metadata: {
            reason: session ? "session_not_fresh" : "unauthenticated",
          },
        }),
      );
    },
  );

  it("requires a recent session before linking another sign-in method", async () => {
    await expect(
      enforceBetterAuthRecentSession(
        endpointContext("/link-social"),
        async () =>
          ({
            session: {
              createdAt: new Date("2026-08-15T11:44:00.000Z"),
              id: "session-1",
            },
            user: { id: "user-1" },
          }) as never,
      ),
    ).rejects.toMatchObject({ body: { code: "SESSION_NOT_FRESH" } });
    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account_link",
        outcome: "denied",
      }),
    );
  });

  it("allowlists changed fields and never audits credential values", async () => {
    const context = endpointContext("/change-password");
    await betterAuthSecurityDatabaseHooks.account?.update?.before?.(
      {
        accessToken: "access-secret",
        password: "password-secret",
        refreshToken: "refresh-secret",
      },
      context,
    );
    await betterAuthSecurityDatabaseHooks.account?.update?.after?.(
      {
        accountId: "provider-account",
        createdAt: new Date(),
        id: "account-1",
        issuer: "local",
        password: "password-secret",
        providerId: "credential",
        updatedAt: new Date(),
        userId: "user-1",
      },
      context,
    );

    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account_credential_update",
        metadata: { changedFields: ["password"] },
      }),
    );
    const serialized = JSON.stringify(fireAuditLogMock.mock.calls);
    expect(serialized).not.toContain("access-secret");
    expect(serialized).not.toContain("password-secret");
    expect(serialized).not.toContain("refresh-secret");
  });

  it("uses the final returned value for passkey success and allowlists body.id", async () => {
    await betterAuthSecurityHooks.after(
      endpointContext("/passkey/delete-passkey", {
        body: { id: "passkey-1", ignored: "private-value" },
        context: {
          returned: { status: true },
          session: {
            session: { id: "session-1" },
            user: { id: "user-1" },
          },
        },
      }),
    );

    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account_passkey_delete",
        outcome: "success",
        targetId: "passkey-1",
      }),
    );
    expect(JSON.stringify(fireAuditLogMock.mock.calls)).not.toContain(
      "private-value",
    );
  });

  it("classifies a final unauthorized sign-in error as denied", async () => {
    const error = new APIError("UNAUTHORIZED", {
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
    });
    await betterAuthSecurityHooks.after(
      endpointContext("/sign-in/email", {
        context: { returned: error, session: null },
      }),
    );

    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account_sign_in",
        metadata: { authMethod: "password" },
        outcome: "denied",
      }),
    );
  });

  it("does not retain the deleted user's raw id after committed deletion", async () => {
    await betterAuthSecurityDatabaseHooks.user?.delete?.after?.(
      {
        createdAt: new Date(),
        email: "deleted@example.test",
        emailVerified: true,
        id: "deleted-user-id",
        image: null,
        name: "Deleted",
        updatedAt: new Date(),
      },
      endpointContext("/delete-user"),
    );
    const serialized = JSON.stringify(fireAuditLogMock.mock.calls);
    expect(serialized).not.toContain("deleted-user-id");
    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account_delete" }),
    );
  });
});
