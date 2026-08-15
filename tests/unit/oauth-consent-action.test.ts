import { makeSignature } from "better-auth/crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitOAuthConsentAction } from "@/features/oauth/server/oauth-consent-action";

const AUTH_SECRET = "oauth-consent-test-secret-at-least-32-bytes";

const {
  bindCodeMock,
  auditCreateMock,
  consentDeleteMock,
  consentFindMock,
  consentUpdateMock,
  consentUpsertMock,
  deviceDeleteMock,
  getSessionMock,
  readClientMock,
  tokenDeleteMock,
  transactionMock,
  txReadClientMock,
  verificationCreateMock,
} = vi.hoisted(() => ({
  bindCodeMock: vi.fn(),
  auditCreateMock: vi.fn(),
  consentDeleteMock: vi.fn(),
  consentFindMock: vi.fn(),
  consentUpdateMock: vi.fn(),
  consentUpsertMock: vi.fn(),
  deviceDeleteMock: vi.fn(),
  getSessionMock: vi.fn(),
  readClientMock: vi.fn(),
  tokenDeleteMock: vi.fn(),
  transactionMock: vi.fn(),
  txReadClientMock: vi.fn(),
  verificationCreateMock: vi.fn(),
}));

vi.mock(
  "@/features/oauth/server/oauth-authorization-code-grant.server",
  () => ({
    bindOAuthAuthorizationCodeRedirectToActiveGrant: bindCodeMock,
  }),
);

vi.mock("@/lib/auth/core", () => ({
  authApi: {
    getSession: getSessionMock,
  },
  betterAuthInstance: {
    $context: Promise.resolve({ secret: AUTH_SECRET }),
  },
}));

const transactionClient = {
  auditLog: { create: auditCreateMock },
  deviceCode: { deleteMany: deviceDeleteMock },
  oAuthAccessToken: { deleteMany: tokenDeleteMock },
  oAuthClient: { findUnique: txReadClientMock },
  oAuthConsent: {
    deleteMany: consentDeleteMock,
    findUnique: consentFindMock,
    update: consentUpdateMock,
    upsert: consentUpsertMock,
  },
  oAuthRefreshToken: { deleteMany: tokenDeleteMock },
  verificationToken: { create: verificationCreateMock },
};

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    $transaction: transactionMock,
    oAuthClient: { findUnique: readClientMock },
  },
}));

function consentRequest(
  body: Record<string, string> | URLSearchParams,
  options: { origin?: string | null } = {},
) {
  const headers = new Headers({
    cookie: "better-auth.session_token=session-token",
    "content-length": "999",
  });
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "https://life.example");
  }

  return new Request("https://life.example/oauth/authorize", {
    method: "POST",
    headers,
    body: body instanceof URLSearchParams ? body : new URLSearchParams(body),
  });
}

async function signedOAuthQuery(overrides: Record<string, string> = {}) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: "client-1",
    redirect_uri: "https://client.example/callback",
    scope: "openid profile",
    state: "state-1",
    code_challenge: "test-code-challenge",
    code_challenge_method: "S256",
    exp: String(Math.floor(Date.now() / 1000) + 600),
    ...overrides,
  });
  query.set("sig", await makeSignature(query.toString(), AUTH_SECRET));
  return query.toString();
}

describe("OAuth consent 操作", () => {
  beforeEach(() => {
    bindCodeMock.mockReset();
    auditCreateMock.mockReset();
    consentDeleteMock.mockReset();
    consentFindMock.mockReset();
    consentUpdateMock.mockReset();
    consentUpsertMock.mockReset();
    deviceDeleteMock.mockReset();
    getSessionMock.mockReset();
    readClientMock.mockReset();
    tokenDeleteMock.mockReset();
    transactionMock.mockReset();
    txReadClientMock.mockReset();
    verificationCreateMock.mockReset();

    getSessionMock.mockResolvedValue({
      session: {
        createdAt: new Date("2026-07-20T00:00:00.000Z"),
        id: "session-1",
      },
      user: { id: "user-1" },
    });
    const client = {
      disabled: false,
      redirectUris: ["https://client.example/callback"],
      scopes: ["openid", "profile"],
      skipConsent: false,
    };
    readClientMock.mockResolvedValue(client);
    txReadClientMock.mockResolvedValue(client);
    transactionMock.mockImplementation((run) => run(transactionClient));
    bindCodeMock.mockResolvedValue(true);
    consentUpdateMock.mockResolvedValue({});
    consentFindMock.mockResolvedValue(null);
    consentUpsertMock.mockResolvedValue({
      grantId: "created-grant",
      requestedUserInfoClaims: [],
      resources: [],
      scopes: [],
    });
    verificationCreateMock.mockResolvedValue({});
    auditCreateMock.mockResolvedValue({});
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("在同一事务创建初始 grant 与 exact-bound code", async () => {
    const oauthQuery = await signedOAuthQuery({
      claims: JSON.stringify({
        id_token: { name: null },
        userinfo: {
          email: { essential: true },
          preferred_username: null,
          unsupported_claim: null,
        },
      }),
      prompt: "consent",
      resource: "https://life.example/api/mcp",
    });

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery,
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringMatching(
        /^https:\/\/client\.example\/callback\?code=/,
      ),
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(tokenDeleteMock).not.toHaveBeenCalled();
    expect(deviceDeleteMock).not.toHaveBeenCalled();
    expect(consentUpsertMock).toHaveBeenCalledWith({
      where: {
        clientId_userId: { clientId: "client-1", userId: "user-1" },
      },
      create: expect.objectContaining({
        clientId: "client-1",
        requestedUserInfoClaims: ["email", "preferred_username"],
        resources: ["https://life.example/api/mcp"],
        scopes: ["openid", "profile"],
        userId: "user-1",
      }),
      update: {},
      select: {
        grantId: true,
        requestedUserInfoClaims: true,
        resources: true,
        scopes: true,
      },
    });
    const stored = JSON.parse(
      verificationCreateMock.mock.calls[0][0].data.token,
    );
    expect(stored).toMatchObject({
      query: expect.not.objectContaining({ prompt: expect.anything() }),
      referenceId: expect.any(String),
      sessionId: "session-1",
      type: "authorization_code",
      userId: "user-1",
    });
    expect(bindCodeMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/client\.example\/callback\?code=/),
      "client-1",
      "https://life.example/oauth/authorize",
      stored.referenceId,
    );
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "oauth_authorization_grant",
        oauthClientId: "client-1",
        oauthGrantId: stored.referenceId,
        sessionId: "session-1",
        userId: "user-1",
      }),
    });
    const serializedAudit = JSON.stringify(auditCreateMock.mock.calls);
    expect(serializedAudit).not.toContain("test-code-challenge");
  });

  it("重复或较窄的 consent 复用 grant 并只扩展已有授权", async () => {
    txReadClientMock.mockResolvedValue({
      disabled: false,
      redirectUris: ["https://client.example/callback"],
      scopes: ["openid", "profile", "workspace.todo:read"],
      skipConsent: false,
    });
    consentUpsertMock.mockResolvedValue({
      grantId: "existing-grant",
      requestedUserInfoClaims: ["email"],
      resources: ["https://life.example/api/graphql"],
      scopes: ["openid", "profile", "workspace.todo:read", "removed:scope"],
    });
    const oauthQuery = await signedOAuthQuery({
      claims: JSON.stringify({
        userinfo: { preferred_username: null },
      }),
      resource: "https://life.example/api/mcp",
      scope: "openid profile",
    });

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery,
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining("https://client.example/callback"),
    });

    expect(consentUpsertMock).toHaveBeenCalledOnce();
    expect(consentUpdateMock).toHaveBeenCalledWith({
      where: {
        clientId_userId: { clientId: "client-1", userId: "user-1" },
      },
      data: {
        requestedUserInfoClaims: ["email", "preferred_username"],
        resources: [
          "https://life.example/api/graphql",
          "https://life.example/api/mcp",
        ],
        scopes: ["openid", "profile", "workspace.todo:read"],
      },
    });
    expect(tokenDeleteMock).not.toHaveBeenCalled();
    expect(deviceDeleteMock).not.toHaveBeenCalled();
    const stored = JSON.parse(
      verificationCreateMock.mock.calls[0][0].data.token,
    );
    expect(stored.referenceId).toBe("existing-grant");
    expect(bindCodeMock).toHaveBeenCalledWith(
      expect.any(String),
      "client-1",
      "https://life.example/oauth/authorize",
      "existing-grant",
    );
  });

  it("trusted client 不创建普通 consent generation", async () => {
    txReadClientMock.mockResolvedValue({
      disabled: false,
      redirectUris: ["https://client.example/callback"],
      scopes: ["openid", "profile"],
      skipConsent: true,
    });

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery(),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining("https://client.example/callback"),
    });

    expect(consentDeleteMock).toHaveBeenCalledWith({
      where: { clientId: "client-1", userId: "user-1" },
    });
    expect(consentUpsertMock).not.toHaveBeenCalled();
    expect(tokenDeleteMock).not.toHaveBeenCalled();
    expect(deviceDeleteMock).not.toHaveBeenCalled();
    const stored = JSON.parse(
      verificationCreateMock.mock.calls[0][0].data.token,
    );
    expect(stored.referenceId).toEqual(expect.any(String));
    expect(bindCodeMock).toHaveBeenCalledWith(
      expect.any(String),
      "client-1",
      "https://life.example/oauth/authorize",
      stored.referenceId,
    );
  });

  it("拒绝授权时验证当前 client 后直接返回 access_denied", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "false",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery(),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining("error=access_denied"),
    });

    expect(readClientMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(bindCodeMock).not.toHaveBeenCalled();
  });

  it("只接受原请求与 client 都允许的勾选 scopes", async () => {
    const oauthQuery = await signedOAuthQuery({
      scope: "openid profile workspace.todo:read",
    });
    txReadClientMock.mockResolvedValue({
      disabled: false,
      redirectUris: ["https://client.example/callback"],
      scopes: ["openid", "profile", "workspace.todo:read"],
      skipConsent: false,
    });
    const body = new URLSearchParams({
      accept: "true",
      scope: "openid profile workspace.todo:read",
      scopeSelectionEnabled: "true",
      oauthQuery,
    });
    body.append("scopes", "openid");
    body.append("scopes", "workspace.todo:read");
    body.append("scopes", "admin:write");
    consentUpsertMock.mockResolvedValueOnce({
      grantId: "selected-grant",
      requestedUserInfoClaims: [],
      resources: [],
      scopes: ["openid", "workspace.todo:read"],
    });

    await expect(
      submitOAuthConsentAction({ request: consentRequest(body) }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining("https://client.example/callback"),
    });

    expect(consentUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          requestedUserInfoClaims: [],
          resources: [],
          scopes: ["openid", "workspace.todo:read"],
        }),
      }),
    );
  });

  it("拒绝重复的 signed claims 参数", async () => {
    const query = new URLSearchParams(
      await signedOAuthQuery({ claims: '{"userinfo":{"email":null}}' }),
    );
    query.delete("sig");
    query.append("claims", '{"userinfo":{"name":null}}');
    query.set("sig", await makeSignature(query.toString(), AUTH_SECRET));

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: query.toString(),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(consentUpsertMock).not.toHaveBeenCalled();
  });

  it("signed state 无效时不触发任何数据库写入", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery:
            "response_type=code&client_id=client-1&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&exp=9999999999&sig=invalid",
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(bindCodeMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "disabled client",
      {
        disabled: true,
        redirectUris: ["https://client.example/callback"],
        scopes: ["openid", "profile"],
        skipConsent: false,
      },
    ],
    [
      "changed redirect",
      {
        disabled: false,
        redirectUris: ["https://other.example/callback"],
        scopes: ["openid", "profile"],
        skipConsent: false,
      },
    ],
    [
      "removed scope",
      {
        disabled: false,
        redirectUris: ["https://client.example/callback"],
        scopes: ["openid"],
        skipConsent: false,
      },
    ],
  ])("事务内重新验证当前 %s", async (_name, client) => {
    txReadClientMock.mockResolvedValue(client);

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery(),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });

    expect(consentUpsertMock).not.toHaveBeenCalled();
    expect(verificationCreateMock).not.toHaveBeenCalled();
  });

  it("只在当前 session 满足签名 login prompt 新鲜度时签发 code", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery({
            prompt: "login consent",
            ba_iat: String(Date.parse("2026-07-20T01:00:00.000Z")),
          }),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });
    expect(transactionMock).not.toHaveBeenCalled();

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery({
            prompt: "login consent",
            ba_iat: String(Date.parse("2026-07-19T23:59:00.000Z")),
          }),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining("https://client.example/callback"),
    });
    const stored = JSON.parse(
      verificationCreateMock.mock.calls[0][0].data.token,
    );
    expect(stored.query).not.toHaveProperty("prompt");
  });

  it("拒绝为其他 session 清除 post-login 的签名 consent state", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery({
            ba_pl: "different-session",
          }),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(verificationCreateMock).not.toHaveBeenCalled();
  });

  it("当前 session 缺失或 PKCE 不再满足时 fail closed", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery(),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery({
            code_challenge: "",
            code_challenge_method: "",
          }),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });
    expect(consentUpsertMock).not.toHaveBeenCalled();
    expect(verificationCreateMock).not.toHaveBeenCalled();
  });

  it("事务内 code 创建失败时不返回客户端 code", async () => {
    verificationCreateMock.mockRejectedValue(new Error("code write failed"));

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: await signedOAuthQuery(),
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });
    expect(bindCodeMock).not.toHaveBeenCalled();
  });

  it("拒绝缺少 origin 或 referer 的携带 cookie 的 consent 请求", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest(
          {
            accept: "true",
            scope: "openid profile",
            oauthQuery: await signedOAuthQuery(),
          },
          { origin: null },
        ),
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("拒绝来自不受信任 origin 的携带 cookie 的 consent 请求", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest(
          {
            accept: "true",
            scope: "openid profile",
            oauthQuery: await signedOAuthQuery(),
          },
          { origin: "https://evil.example" },
        ),
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(transactionMock).not.toHaveBeenCalled();
  });
});
