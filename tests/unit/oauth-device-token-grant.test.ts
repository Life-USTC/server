import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { DEVICE_CODE_STATUS } from "@/lib/oauth/device-code";

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const issueDeviceGrantTokensMock = vi.fn();
const logOAuthDebugMock = vi.fn();
const logAppEventMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    deviceCode: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

vi.mock("@/features/oauth/server/device-token-issuer.server", () => ({
  issueDeviceGrantTokens: issueDeviceGrantTokensMock,
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: logOAuthDebugMock,
}));
vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthProviderValidAudiences: () => [
    "https://life.example/api/auth",
    "https://life.example/api/mcp",
  ],
}));

function approvedDeviceRecord(resources = ["https://life.example/api/mcp"]) {
  return {
    id: "device-record-1",
    client: {
      clientId: "client-1",
      disabled: false,
      grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
      public: true,
      tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
      type: "public",
    },
    expiresAt: new Date(Date.now() + 60_000),
    lastPolledAt: null,
    resources,
    scopes: [OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE],
    status: DEVICE_CODE_STATUS.APPROVED,
    userId: "user-1",
  };
}

describe("设备令牌授予", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    issueDeviceGrantTokensMock.mockReset();
    logOAuthDebugMock.mockReset();
    logAppEventMock.mockReset();
    updateMock.mockResolvedValue({});
    issueDeviceGrantTokensMock.mockResolvedValue({
      accessToken: "access-token",
      expiresIn: 3600,
    });
  });

  it("令牌轮询省略资源时继承已批准资源", async () => {
    findUniqueMock.mockResolvedValue(approvedDeviceRecord());
    const { handleDeviceCodeGrant } = await import(
      "@/lib/api/routes/auth-token-device-grant"
    );

    const response = await handleDeviceCodeGrant(
      new Request("https://life.example/api/auth/oauth2/token", {
        method: "POST",
      }),
      new URLSearchParams({
        client_id: "client-1",
        device_code: "device-code-1",
      }),
    );

    expect(response.status).toBe(200);
    expect(issueDeviceGrantTokensMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        resources: ["https://life.example/api/mcp"],
      }),
    );
    expect(logOAuthDebugMock).toHaveBeenCalledWith(
      "device-token.success",
      expect.any(Request),
      expect.not.objectContaining({ userId: expect.anything() }),
    );
  });

  it("拒绝更改已批准资源集的令牌轮询", async () => {
    findUniqueMock.mockResolvedValue(
      approvedDeviceRecord(["https://life.example/api/mcp"]),
    );
    const { handleDeviceCodeGrant } = await import(
      "@/lib/api/routes/auth-token-device-grant"
    );

    const response = await handleDeviceCodeGrant(
      new Request("https://life.example/api/auth/oauth2/token", {
        method: "POST",
      }),
      new URLSearchParams({
        client_id: "client-1",
        device_code: "device-code-1",
        resource: "https://life.example/api/auth",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_target",
    });
    expect(issueDeviceGrantTokensMock).not.toHaveBeenCalled();
  });

  it("记录批准状态缺少用户的服务端状态异常", async () => {
    findUniqueMock.mockResolvedValue({
      ...approvedDeviceRecord(),
      userId: null,
    });
    const { handleDeviceCodeGrant } = await import(
      "@/lib/api/routes/auth-token-device-grant"
    );

    const response = await handleDeviceCodeGrant(
      new Request("https://life.example/api/auth/oauth2/token", {
        method: "POST",
      }),
      new URLSearchParams({
        client_id: "client-1",
        device_code: "device-code-1",
      }),
    );

    expect(response.status).toBe(500);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "oauth.device-token.grant-resolution-failed",
      {
        event: "oauth.device-token.grant-resolution-failed",
        phase: "resolve-grant",
      },
    );
  });
});
