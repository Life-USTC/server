import { makeSignature } from "better-auth/crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitOAuthConsentAction } from "@/features/oauth/server/oauth-consent-action";

const AUTH_SECRET = "oauth-consent-test-secret-at-least-32-bytes";

const {
  bindCodeMock,
  consentDeleteMock,
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
  consentDeleteMock: vi.fn(),
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
  deviceCode: { deleteMany: deviceDeleteMock },
  oAuthAccessToken: { deleteMany: tokenDeleteMock },
  oAuthClient: { findUnique: txReadClientMock },
  oAuthConsent: {
    deleteMany: consentDeleteMock,
    upsert: consentUpsertMock,
  },
  oAuthRefreshToken: { deleteMany: tokenDeleteMock },
  verificationToken: { create: verificationCreateMock },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
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
    consentDeleteMock.mockReset();
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
    verificationCreateMock.mockResolvedValue({});
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("在同一事务轮换 grant、清理旧行并创建 exact-bound code", async () => {
    const oauthQuery = await signedOAuthQuery({ prompt: "consent" });

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
    expect(tokenDeleteMock).toHaveBeenCalledTimes(2);
    expect(deviceDeleteMock).toHaveBeenCalledWith({
      where: { clientId: "client-1", userId: "user-1" },
    });
    expect(consentUpsertMock).toHaveBeenCalledWith({
      where: {
        clientId_userId: { clientId: "client-1", userId: "user-1" },
      },
      create: expect.objectContaining({
        clientId: "client-1",
        grantId: expect.any(String),
        scopes: ["openid", "profile"],
        userId: "user-1",
      }),
      update: expect.objectContaining({
        grantId: expect.any(String),
        scopes: ["openid", "profile"],
      }),
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
      scope: "openid profile todo:read",
    });
    txReadClientMock.mockResolvedValue({
      disabled: false,
      redirectUris: ["https://client.example/callback"],
      scopes: ["openid", "profile", "todo:read"],
      skipConsent: false,
    });
    const body = new URLSearchParams({
      accept: "true",
      scope: "openid profile todo:read",
      scopeSelectionEnabled: "true",
      oauthQuery,
    });
    body.append("scopes", "openid");
    body.append("scopes", "todo:read");
    body.append("scopes", "admin:write");

    await expect(
      submitOAuthConsentAction({ request: consentRequest(body) }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringContaining("https://client.example/callback"),
    });

    expect(consentUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ scopes: ["openid", "todo:read"] }),
        update: expect.objectContaining({ scopes: ["openid", "todo:read"] }),
      }),
    );
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
