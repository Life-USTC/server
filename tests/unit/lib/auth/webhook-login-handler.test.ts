import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOptionalTrimmedEnvMock,
  findFirstMock,
  createSessionMock,
  findUserByIdMock,
  setSessionCookieMock,
  fireAuditLogMock,
} = vi.hoisted(() => ({
  getOptionalTrimmedEnvMock: vi.fn(),
  findFirstMock: vi.fn(),
  createSessionMock: vi.fn(),
  findUserByIdMock: vi.fn(),
  setSessionCookieMock: vi.fn(),
  fireAuditLogMock: vi.fn(),
}));

vi.mock("@/app-env", () => ({
  getOptionalTrimmedEnv: getOptionalTrimmedEnvMock,
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: {
    user: {
      findFirst: findFirstMock,
    },
  },
}));

vi.mock("better-auth/cookies", () => ({
  setSessionCookie: setSessionCookieMock,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: fireAuditLogMock,
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: vi.fn(),
}));

import {
  handleWebhookLogin,
  isWebhookLoginEnabled,
} from "@/lib/auth/webhook-login-handler";

function envMap(values: Record<string, string | undefined>) {
  getOptionalTrimmedEnvMock.mockImplementation((key: string) => values[key]);
}

describe("webhook login hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fireAuditLogMock.mockResolvedValue(undefined);
    setSessionCookieMock.mockResolvedValue(undefined);
  });

  it("is disabled unless both WEBHOOK_LOGIN_ENABLED=true and WEBHOOK_SECRET are set", () => {
    envMap({ WEBHOOK_LOGIN_ENABLED: "true", WEBHOOK_SECRET: "secret" });
    expect(isWebhookLoginEnabled()).toBe(true);

    envMap({ WEBHOOK_LOGIN_ENABLED: undefined, WEBHOOK_SECRET: "secret" });
    expect(isWebhookLoginEnabled()).toBe(false);

    envMap({ WEBHOOK_LOGIN_ENABLED: "true", WEBHOOK_SECRET: undefined });
    expect(isWebhookLoginEnabled()).toBe(false);

    envMap({ WEBHOOK_LOGIN_ENABLED: "false", WEBHOOK_SECRET: "secret" });
    expect(isWebhookLoginEnabled()).toBe(false);
  });

  it("rejects invalid secrets with 403", async () => {
    envMap({ WEBHOOK_SECRET: "expected-secret" });

    const response = (await handleWebhookLogin({
      body: { secret: "wrong-secret", email: "user@example.com" },
      context: {
        internalAdapter: {
          createSession: createSessionMock,
          findUserById: findUserByIdMock,
        },
      },
      json: vi.fn(),
      request: new Request("https://example.test/api/auth/webhook/login"),
    })) as Response;

    expect(response.status).toBe(403);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("sets a session cookie and omits sessionToken from the body", async () => {
    envMap({ WEBHOOK_SECRET: "expected-secret" });
    findFirstMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });
    findUserByIdMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });
    createSessionMock.mockResolvedValue({
      token: "must-not-leak",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const json = vi.fn(async (body: Record<string, unknown>) => body);

    const body = await handleWebhookLogin({
      body: { secret: "expected-secret", email: "user@example.com" },
      context: {
        internalAdapter: {
          createSession: createSessionMock,
          findUserById: findUserByIdMock,
        },
      },
      json,
      request: new Request("https://example.test/api/auth/webhook/login", {
        headers: {
          "user-agent": "vitest",
          "x-forwarded-for": "203.0.113.10",
        },
      }),
    });

    expect(setSessionCookieMock).toHaveBeenCalledOnce();
    expect(fireAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "webhook_login",
        userId: "user-1",
        targetId: "user-1",
        targetType: "user",
        metadata: { lookup: "email" },
      }),
    );
    expect(body).toEqual({
      ok: true,
      userId: "user-1",
      email: "user@example.com",
      expires: "2030-01-01T00:00:00.000Z",
    });
    expect(body).not.toHaveProperty("sessionToken");
  });
});
