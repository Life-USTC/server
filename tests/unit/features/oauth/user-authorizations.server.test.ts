import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const accessDeleteMany = vi.fn();
  const clientFindUnique = vi.fn();
  const consentDeleteMany = vi.fn();
  const consentFindFirst = vi.fn();
  const consentFindMany = vi.fn();
  const consentFindUnique = vi.fn();
  const consentUpdateMany = vi.fn();
  const deviceDeleteMany = vi.fn();
  const grantUsageDeleteMany = vi.fn();
  const grantUsageFindMany = vi.fn();
  const refreshDeleteMany = vi.fn();
  const refreshFindFirst = vi.fn();
  const refreshFindUnique = vi.fn();
  const refreshUpdateMany = vi.fn();
  const transactionRunner = vi.fn();
  const transaction = {
    oAuthAccessToken: { deleteMany: accessDeleteMany },
    oAuthConsent: {
      deleteMany: consentDeleteMany,
      findFirst: consentFindFirst,
      findUnique: consentFindUnique,
      updateMany: consentUpdateMany,
    },
    oAuthGrantUsageDaily: {
      deleteMany: grantUsageDeleteMany,
      findMany: grantUsageFindMany,
    },
    oAuthRefreshToken: {
      deleteMany: refreshDeleteMany,
      findFirst: refreshFindFirst,
      findUnique: refreshFindUnique,
      updateMany: refreshUpdateMany,
    },
    deviceCode: { deleteMany: deviceDeleteMany },
    oAuthClient: { findUnique: clientFindUnique },
  };

  return {
    accessDeleteMany,
    activeGrant: vi.fn(),
    clientFindUnique,
    consentDeleteMany,
    consentFindFirst,
    consentFindMany,
    consentFindUnique,
    consentUpdateMany,
    deviceDeleteMany,
    grantUsageDeleteMany,
    grantUsageFindMany,
    hashSecret: vi.fn(),
    refreshDeleteMany,
    refreshFindFirst,
    refreshFindUnique,
    refreshUpdateMany,
    transaction,
    transactionRunner,
    writeAuditLog: vi.fn(),
  };
});

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    $transaction: mocks.transactionRunner,
    oAuthAccessToken: { deleteMany: mocks.accessDeleteMany },
    oAuthClient: { findUnique: mocks.clientFindUnique },
    oAuthConsent: {
      deleteMany: mocks.consentDeleteMany,
      findFirst: mocks.consentFindFirst,
      findMany: mocks.consentFindMany,
      findUnique: mocks.consentFindUnique,
      updateMany: mocks.consentUpdateMany,
    },
    oAuthGrantUsageDaily: {
      deleteMany: mocks.grantUsageDeleteMany,
      findMany: mocks.grantUsageFindMany,
    },
    oAuthRefreshToken: {
      deleteMany: mocks.refreshDeleteMany,
      findFirst: mocks.refreshFindFirst,
      findUnique: mocks.refreshFindUnique,
      updateMany: mocks.refreshUpdateMany,
    },
    deviceCode: { deleteMany: mocks.deviceDeleteMany },
  },
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: mocks.activeGrant,
}));

vi.mock("@/lib/oauth/utils", () => ({
  hashOAuthClientSecretForDbStorage: mocks.hashSecret,
}));

const USER_ID = "user-1";
const CLIENT_ID = "client-1";
const TOMBSTONE = "urn:life-ustc:oauth:refresh-replay-tombstone";

function consentRow(overrides: Record<string, unknown> = {}) {
  return {
    client: { disabled: false, name: "Calendar", uri: "https://calendar.test" },
    clientId: CLIENT_ID,
    grantId: "grant-1",
    id: "consent-1",
    scopes: ["profile", "profile", "calendar:read"],
    updatedAt: new Date("2026-09-14T10:00:00.000Z"),
    ...overrides,
  };
}

function refreshRow(overrides: Record<string, unknown> = {}) {
  return {
    clientId: CLIENT_ID,
    expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    grantId: "grant-1",
    id: "refresh-1",
    referenceId: null,
    revoked: null,
    scopes: ["profile"],
    userId: USER_ID,
    ...overrides,
  };
}

describe("user OAuth authorizations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transactionRunner.mockImplementation(
      async (callback: (tx: typeof mocks.transaction) => Promise<unknown>) =>
        callback(mocks.transaction),
    );
    mocks.hashSecret.mockImplementation(
      async (secret: string) => `hashed:${secret}`,
    );
    mocks.activeGrant.mockResolvedValue(true);
    mocks.clientFindUnique.mockResolvedValue(null);
    mocks.consentFindFirst.mockResolvedValue(null);
    mocks.consentFindMany.mockResolvedValue([]);
    mocks.consentFindUnique.mockResolvedValue(null);
    mocks.consentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.grantUsageFindMany.mockResolvedValue([]);
    mocks.refreshFindFirst.mockResolvedValue(null);
    mocks.refreshFindUnique.mockResolvedValue(null);
    mocks.refreshUpdateMany.mockResolvedValue({ count: 1 });
    mocks.accessDeleteMany.mockResolvedValue({ count: 0 });
    mocks.refreshDeleteMany.mockResolvedValue({ count: 0 });
    mocks.deviceDeleteMany.mockResolvedValue({ count: 0 });
    mocks.grantUsageDeleteMany.mockResolvedValue({ count: 0 });
    mocks.consentDeleteMany.mockResolvedValue({ count: 0 });
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists consents with deduplicated scopes and aggregated recent usage", async () => {
    const firstUpdatedAt = new Date("2026-09-14T10:00:00.000Z");
    const olderUse = new Date("2026-09-10T00:00:00.000Z");
    const newerUse = new Date("2026-09-12T00:00:00.000Z");
    mocks.consentFindMany.mockResolvedValue([
      consentRow({ updatedAt: firstUpdatedAt }),
      consentRow({
        client: { disabled: true, name: null, uri: null },
        clientId: "client-2",
        grantId: null,
        id: "consent-2",
        scopes: ["z"],
        updatedAt: new Date("2026-09-13T10:00:00.000Z"),
      }),
    ]);
    mocks.grantUsageFindMany.mockResolvedValue([
      {
        channel: "web",
        clientId: CLIENT_ID,
        errorCount: 1,
        feature: "calendar",
        grantKey: "grant:grant-1",
        lastUsedAt: olderUse,
        readCount: 2,
        writeCount: 3,
      },
      {
        channel: "api",
        clientId: CLIENT_ID,
        errorCount: 4,
        feature: "export",
        grantKey: "grant:grant-1",
        lastUsedAt: newerUse,
        readCount: 5,
        writeCount: 6,
      },
      {
        channel: "web",
        clientId: CLIENT_ID,
        errorCount: 8,
        feature: "legacy",
        grantKey: "none",
        lastUsedAt: olderUse,
        readCount: 9,
        writeCount: 10,
      },
    ]);
    const { listUserOAuthAuthorizations } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      listUserOAuthAuthorizations(
        USER_ID,
        new Date("2026-09-15T12:00:00.000Z"),
      ),
    ).resolves.toEqual([
      {
        clientName: "Calendar",
        clientUri: "https://calendar.test",
        consentId: "consent-1",
        disabled: false,
        scopes: ["calendar:read", "profile"],
        updatedAt: firstUpdatedAt.toISOString(),
        usage: {
          errorCount: 5,
          lastChannel: "api",
          lastFeature: "export",
          lastUsedAt: newerUse.toISOString(),
          readCount: 7,
          writeCount: 9,
        },
      },
      {
        clientName: null,
        clientUri: null,
        consentId: "consent-2",
        disabled: true,
        scopes: ["z"],
        updatedAt: "2026-09-13T10:00:00.000Z",
        usage: null,
      },
    ]);
    expect(mocks.consentFindMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        client: { OR: [{ skipConsent: false }, { skipConsent: null }] },
      },
      orderBy: { updatedAt: "desc" },
      select: expect.objectContaining({
        clientId: true,
        grantId: true,
        scopes: true,
      }),
    });
    expect(mocks.grantUsageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: { in: [CLIENT_ID, "client-2"] },
          day: { gte: new Date("2026-08-17T00:00:00.000Z") },
          userId: USER_ID,
        }),
      }),
    );
  });

  it("does not query usage when the user has no OAuth consents", async () => {
    const { listUserOAuthAuthorizations } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(listUserOAuthAuthorizations(USER_ID)).resolves.toEqual([]);
    expect(mocks.grantUsageFindMany).not.toHaveBeenCalled();
  });

  it("reports a missing consent without opening a deletion transaction", async () => {
    const { revokeUserOAuthAuthorization } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      revokeUserOAuthAuthorization(USER_ID, "missing-consent"),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(mocks.transactionRunner).not.toHaveBeenCalled();
  });

  it("revokes all consent-owned credentials and records the supplied audit context", async () => {
    mocks.consentFindFirst.mockResolvedValue({
      clientId: CLIENT_ID,
      grantId: "grant-1",
    });
    mocks.accessDeleteMany.mockResolvedValue({ count: 2 });
    mocks.refreshDeleteMany.mockResolvedValue({ count: 3 });
    mocks.deviceDeleteMany.mockResolvedValue({ count: 4 });
    mocks.consentDeleteMany.mockResolvedValue({ count: 1 });
    const audit = {
      channel: "web",
      ipAddress: "192.0.2.10",
      requestId: "req-1",
      sessionId: "session-1",
      userAgent: "test-agent",
    } as const;
    const { revokeUserOAuthAuthorization } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      revokeUserOAuthAuthorization(USER_ID, "consent-1", audit),
    ).resolves.toEqual({
      ok: true,
      deleted: {
        accessTokens: 2,
        consents: 1,
        deviceCodes: 4,
        refreshTokens: 3,
      },
    });
    expect(mocks.accessDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.refreshDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.deviceDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.grantUsageDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.consentDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {
        action: "oauth_authorization_revoke",
        oauthClientId: CLIENT_ID,
        oauthGrantId: "grant-1",
        subjectUserId: USER_ID,
        targetId: "consent-1",
        targetType: "oauth_consent",
        userId: USER_ID,
        metadata: {
          revokedAccessTokenCount: 2,
          revokedDeviceCodeCount: 4,
          revokedRefreshTokenCount: 3,
        },
        ...audit,
      },
      mocks.transaction,
    );
  });

  it("rejects absent, revoked, and expired refresh tokens before grant checks", async () => {
    const { resolveActiveOAuthRefreshGrant } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );
    await expect(resolveActiveOAuthRefreshGrant(null)).resolves.toBeNull();
    await expect(resolveActiveOAuthRefreshGrant("")).resolves.toBeNull();
    expect(mocks.hashSecret).not.toHaveBeenCalled();

    mocks.hashSecret.mockResolvedValue("hashed:revoked");
    mocks.refreshFindUnique.mockResolvedValueOnce(
      refreshRow({ revoked: new Date() }),
    );
    await expect(resolveActiveOAuthRefreshGrant("revoked")).resolves.toBeNull();

    mocks.refreshFindUnique.mockResolvedValueOnce(
      refreshRow({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
    );
    await expect(resolveActiveOAuthRefreshGrant("expired")).resolves.toBeNull();
    expect(mocks.activeGrant).not.toHaveBeenCalled();
  });

  it("resolves a live refresh token through its reference lineage and binds its scopes", async () => {
    mocks.refreshFindUnique.mockResolvedValue(
      refreshRow({
        grantId: null,
        referenceId: "grant-reference",
        scopes: ["profile"],
      }),
    );
    const { resolveActiveOAuthRefreshGrant } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      resolveActiveOAuthRefreshGrant("refresh-secret"),
    ).resolves.toEqual({
      clientId: CLIENT_ID,
      grantId: "grant-reference",
      scopes: ["profile"],
      userId: USER_ID,
    });
    expect(mocks.hashSecret).toHaveBeenCalledWith("refresh-secret");
    expect(mocks.refreshFindUnique).toHaveBeenCalledWith({
      where: { token: "hashed:refresh-secret" },
      select: expect.objectContaining({
        clientId: true,
        grantId: true,
        referenceId: true,
        userId: true,
      }),
    });
    expect(mocks.activeGrant).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      grantId: "grant-reference",
      requireGrantBinding: true,
      scopes: ["profile"],
      userId: USER_ID,
    });
    expect(mocks.refreshFindFirst).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        OR: [
          { grantId: "grant-reference" },
          { referenceId: "grant-reference" },
        ],
        revoked: { not: null },
        scopes: { has: TOMBSTONE },
      },
      select: { id: true },
    });
  });

  it("rejects a refresh token when its grant is inactive or has a replay tombstone", async () => {
    mocks.refreshFindUnique.mockResolvedValue(refreshRow());
    const { resolveActiveOAuthRefreshGrant } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    mocks.activeGrant.mockResolvedValueOnce(false);
    await expect(
      resolveActiveOAuthRefreshGrant("inactive"),
    ).resolves.toBeNull();

    mocks.activeGrant.mockResolvedValueOnce(true);
    mocks.refreshFindFirst.mockResolvedValueOnce({ id: "tombstone" });
    await expect(
      resolveActiveOAuthRefreshGrant("replayed"),
    ).resolves.toBeNull();
  });

  it("requires both the active grant and the absence of a replay tombstone", async () => {
    const { isOAuthRefreshGrantActive } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );
    const grant = {
      clientId: CLIENT_ID,
      grantId: "grant-1",
      scopes: ["profile"],
      userId: USER_ID,
    };

    await expect(isOAuthRefreshGrantActive(grant)).resolves.toBe(true);
    expect(mocks.activeGrant).toHaveBeenCalledWith({
      ...grant,
      requireGrantBinding: true,
    });
    mocks.refreshFindFirst.mockResolvedValueOnce({ id: "tombstone" });
    await expect(isOAuthRefreshGrantActive(grant)).resolves.toBe(false);
    mocks.activeGrant.mockResolvedValueOnce(false);
    await expect(isOAuthRefreshGrantActive(grant)).resolves.toBe(false);
  });

  it("purges active token rows for a specific grant lineage", async () => {
    const { purgeOAuthGrantTokenRows } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );
    await purgeOAuthGrantTokenRows({
      clientId: CLIENT_ID,
      grantId: "grant-1",
      scopes: ["profile"],
      userId: USER_ID,
    });

    expect(mocks.accessDeleteMany).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        OR: [{ grantId: "grant-1" }, { referenceId: "grant-1" }],
      },
    });
    expect(mocks.refreshDeleteMany).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        OR: [{ grantId: "grant-1" }, { referenceId: "grant-1" }],
        revoked: null,
      },
    });
  });

  it("purges token rows with the null lineage for an unbound grant", async () => {
    const { purgeOAuthGrantTokenRows } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );
    await purgeOAuthGrantTokenRows({
      clientId: CLIENT_ID,
      scopes: [],
      userId: USER_ID,
    });

    expect(mocks.accessDeleteMany).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        grantId: null,
        referenceId: null,
      },
    });
    expect(mocks.refreshDeleteMany).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        grantId: null,
        referenceId: null,
        revoked: null,
      },
    });
  });

  it("returns false when purging a missing, unrevoked, or unrelated lineage", async () => {
    const { purgeRevokedOAuthRefreshTokenLineage } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );
    await expect(purgeRevokedOAuthRefreshTokenLineage(null)).resolves.toBe(
      false,
    );

    mocks.refreshFindUnique.mockResolvedValueOnce(null);
    await expect(purgeRevokedOAuthRefreshTokenLineage("missing")).resolves.toBe(
      false,
    );

    mocks.refreshFindUnique.mockResolvedValueOnce(
      refreshRow({ revoked: null }),
    );
    mocks.refreshFindFirst.mockResolvedValueOnce(null);
    await expect(purgeRevokedOAuthRefreshTokenLineage("live")).resolves.toBe(
      false,
    );
    expect(mocks.accessDeleteMany).not.toHaveBeenCalled();
  });

  it("marks a revoked token as a replay tombstone, rotates its consent, and purges its lineage", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00.000Z"));
    mocks.refreshFindUnique.mockResolvedValue(
      refreshRow({
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        revoked: new Date("2026-09-10T00:00:00.000Z"),
        scopes: ["profile"],
      }),
    );
    const { purgeRevokedOAuthRefreshTokenLineage } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      purgeRevokedOAuthRefreshTokenLineage("revoked-secret"),
    ).resolves.toBe(true);
    expect(mocks.refreshUpdateMany).toHaveBeenCalledWith({
      where: { id: "refresh-1", revoked: { not: null } },
      data: {
        expiresAt: new Date("2026-10-15T00:00:00.000Z"),
        scopes: ["profile", TOMBSTONE],
      },
    });
    expect(mocks.consentUpdateMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID, grantId: "grant-1" },
      data: { grantId: expect.any(String) },
    });
    expect(mocks.accessDeleteMany).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        OR: [{ grantId: "grant-1" }, { referenceId: "grant-1" }],
      },
    });
    expect(mocks.refreshDeleteMany).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        OR: [{ grantId: "grant-1" }, { referenceId: "grant-1" }],
        revoked: null,
      },
    });
  });

  it("purges an already marked lineage without extending or rewriting its tombstone", async () => {
    mocks.refreshFindUnique.mockResolvedValue(
      refreshRow({ scopes: ["profile", TOMBSTONE], revoked: new Date() }),
    );
    const { purgeRevokedOAuthRefreshTokenLineage } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      purgeRevokedOAuthRefreshTokenLineage("marked-secret"),
    ).resolves.toBe(true);
    expect(mocks.refreshUpdateMany).not.toHaveBeenCalled();
    expect(mocks.consentUpdateMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID, grantId: "grant-1" },
      data: { grantId: expect.any(String) },
    });
  });

  it("finds a tombstone for an unrevoked token and skips consent rotation without a grant ID", async () => {
    mocks.refreshFindUnique.mockResolvedValue(
      refreshRow({ grantId: null, referenceId: null, revoked: null }),
    );
    mocks.refreshFindFirst.mockResolvedValue({ id: "tombstone" });
    const { purgeRevokedOAuthRefreshTokenLineage } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      purgeRevokedOAuthRefreshTokenLineage("tombstone-secret"),
    ).resolves.toBe(true);
    expect(mocks.refreshFindFirst).toHaveBeenCalledWith({
      where: {
        clientId: CLIENT_ID,
        userId: USER_ID,
        grantId: null,
        referenceId: null,
        revoked: { not: null },
        scopes: { has: TOMBSTONE },
      },
      select: { id: true },
    });
    expect(mocks.consentUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown scope without rotating the user's grant", async () => {
    mocks.consentFindFirst.mockResolvedValue({
      client: { scopes: ["profile"] },
      clientId: CLIENT_ID,
    });
    const { updateUserOAuthAuthorizationScopes } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      updateUserOAuthAuthorizationScopes(USER_ID, "consent-1", ["admin"]),
    ).resolves.toEqual({ ok: false, reason: "invalid_scope" });
    expect(mocks.accessDeleteMany).not.toHaveBeenCalled();
    expect(mocks.consentUpdateMany).not.toHaveBeenCalled();
  });

  it("normalizes scopes, rotates credentials, and records an update audit", async () => {
    mocks.consentFindFirst.mockResolvedValue({
      client: { scopes: ["calendar:read", "profile"] },
      clientId: CLIENT_ID,
    });
    mocks.accessDeleteMany.mockResolvedValue({ count: 3 });
    mocks.refreshDeleteMany.mockResolvedValue({ count: 2 });
    mocks.deviceDeleteMany.mockResolvedValue({ count: 1 });
    mocks.grantUsageDeleteMany.mockResolvedValue({ count: 5 });
    const { updateUserOAuthAuthorizationScopes } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      updateUserOAuthAuthorizationScopes(USER_ID, "consent-1", [
        "profile",
        "calendar:read",
        "profile",
      ]),
    ).resolves.toEqual({
      ok: true,
      consentId: "consent-1",
      grantId: expect.any(String),
      scopes: ["calendar:read", "profile"],
    });
    expect(mocks.accessDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.refreshDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.deviceDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.grantUsageDeleteMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, userId: USER_ID },
    });
    expect(mocks.consentUpdateMany).toHaveBeenCalledWith({
      where: { id: "consent-1", clientId: CLIENT_ID, userId: USER_ID },
      data: {
        grantId: expect.any(String),
        scopes: ["calendar:read", "profile"],
      },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "oauth_authorization_update",
        metadata: { changedFields: ["scopes"], scopeCount: 2 },
      }),
      mocks.transaction,
    );
  });

  it("returns not found when scope rotation loses its compare-and-set race", async () => {
    mocks.consentFindFirst.mockResolvedValue({
      client: { scopes: ["profile"] },
      clientId: CLIENT_ID,
    });
    mocks.consentUpdateMany.mockResolvedValue({ count: 0 });
    const { updateUserOAuthAuthorizationScopes } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      updateUserOAuthAuthorizationScopes(USER_ID, "consent-1", ["profile"]),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([null, { disabled: true, skipConsent: false }])(
    "does not rotate a missing or disabled OAuth client (%j)",
    async (client) => {
      mocks.clientFindUnique.mockResolvedValue(client);
      const { rotateOAuthUserGrantAfterConsent } = await import(
        "@/features/oauth/server/user-authorizations.server"
      );

      await expect(
        rotateOAuthUserGrantAfterConsent({
          clientId: CLIENT_ID,
          scopes: ["profile"],
          userId: USER_ID,
        }),
      ).resolves.toBeNull();
      expect(mocks.consentFindUnique).not.toHaveBeenCalled();
    },
  );

  it("cleans up old consents for a trusted client without creating a grant", async () => {
    mocks.clientFindUnique.mockResolvedValue({
      disabled: false,
      skipConsent: true,
    });
    mocks.consentDeleteMany.mockResolvedValue({ count: 2 });
    const { rotateOAuthUserGrantAfterConsent } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      rotateOAuthUserGrantAfterConsent({
        clientId: "trusted-client",
        scopes: ["profile"],
        userId: USER_ID,
      }),
    ).resolves.toEqual({ kind: "trusted" });
    expect(mocks.consentDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "trusted-client", userId: USER_ID },
    });
    expect(mocks.consentFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when a nontrusted client has no consent", async () => {
    mocks.clientFindUnique.mockResolvedValue({
      disabled: false,
      skipConsent: false,
    });
    const { rotateOAuthUserGrantAfterConsent } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      rotateOAuthUserGrantAfterConsent({
        clientId: CLIENT_ID,
        scopes: ["profile"],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
    expect(mocks.consentFindUnique).toHaveBeenCalledWith({
      where: { clientId_userId: { clientId: CLIENT_ID, userId: USER_ID } },
      select: { id: true },
    });
  });

  it("rotates a consent grant with sorted scopes and removes prior credentials", async () => {
    mocks.clientFindUnique.mockResolvedValue({
      disabled: false,
      skipConsent: null,
    });
    mocks.consentFindUnique.mockResolvedValue({ id: "consent-1" });
    mocks.accessDeleteMany.mockResolvedValue({ count: 1 });
    mocks.refreshDeleteMany.mockResolvedValue({ count: 1 });
    mocks.deviceDeleteMany.mockResolvedValue({ count: 1 });
    mocks.grantUsageDeleteMany.mockResolvedValue({ count: 1 });
    const { rotateOAuthUserGrantAfterConsent } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      rotateOAuthUserGrantAfterConsent({
        clientId: CLIENT_ID,
        scopes: ["z", "a", "z"],
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      consentId: "consent-1",
      grantId: expect.any(String),
      kind: "consent",
      scopes: ["a", "z"],
    });
    expect(mocks.consentUpdateMany).toHaveBeenCalledWith({
      where: { id: "consent-1", clientId: CLIENT_ID, userId: USER_ID },
      data: { grantId: expect.any(String), scopes: ["a", "z"] },
    });
  });

  it("returns null when consent grant rotation does not update a row", async () => {
    mocks.clientFindUnique.mockResolvedValue({
      disabled: false,
      skipConsent: false,
    });
    mocks.consentFindUnique.mockResolvedValue({ id: "consent-1" });
    mocks.consentUpdateMany.mockResolvedValue({ count: 0 });
    const { rotateOAuthUserGrantAfterConsent } = await import(
      "@/features/oauth/server/user-authorizations.server"
    );

    await expect(
      rotateOAuthUserGrantAfterConsent({
        clientId: CLIENT_ID,
        scopes: [],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });
});
