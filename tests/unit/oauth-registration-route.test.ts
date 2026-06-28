import { beforeEach, describe, expect, it, vi } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";

const { betterAuthHandlerMock, oauthClientUpdateMock } = vi.hoisted(() => ({
  betterAuthHandlerMock: vi.fn(),
  oauthClientUpdateMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    handler: betterAuthHandlerMock,
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthClient: {
      update: oauthClientUpdateMock,
    },
  },
}));

describe("OAuth 注册路由", () => {
  beforeEach(() => {
    betterAuthHandlerMock.mockReset();
    oauthClientUpdateMock.mockReset();
  });

  it("动态客户端注册时拒绝 client_credentials", async () => {
    const response = await authPostRoute(
      new Request("https://life.example/api/auth/oauth2/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "unsupported-client",
          grant_types: ["client_credentials"],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_client_metadata",
      error_description: "Unsupported grant type: client_credentials",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
    expect(oauthClientUpdateMock).not.toHaveBeenCalled();
  });

  it("动态客户端注册时拒绝 falsy 的不支持授权值", async () => {
    const response = await authPostRoute(
      new Request("https://life.example/api/auth/oauth2/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "bad-device-client",
          grant_types: ["", OAUTH_DEVICE_CODE_GRANT_TYPE],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_client_metadata",
      error_description: "Unsupported grant type: ",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
    expect(oauthClientUpdateMock).not.toHaveBeenCalled();
  });

  it("通过 Better Auth 适配器注册自定义设备授权", async () => {
    betterAuthHandlerMock.mockImplementationOnce(async (request: Request) => {
      const delegatedBody = await request.json();
      expect(delegatedBody).toMatchObject({
        client_name: "device-client",
        grant_types: [OAUTH_REFRESH_TOKEN_GRANT_TYPE],
      });
      expect(delegatedBody.redirect_uris).toEqual([
        "http://127.0.0.1/oauth/device-registration-callback",
      ]);
      return Response.json(
        {
          client_id: "device-client-id",
          client_name: "device-client",
          grant_types: [OAUTH_REFRESH_TOKEN_GRANT_TYPE],
          redirect_uris: [
            "http://127.0.0.1/oauth/device-registration-callback",
          ],
        },
        {
          status: 201,
          headers: {
            "cache-control": "no-store",
            pragma: "no-cache",
          },
        },
      );
    });
    const response = await authPostRoute(
      new Request("https://life.example/api/auth/oauth2/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "device-client",
          grant_types: [OAUTH_DEVICE_CODE_GRANT_TYPE],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      client_id: "device-client-id",
      grant_types: [OAUTH_DEVICE_CODE_GRANT_TYPE],
      redirect_uris: [],
    });
    expect(oauthClientUpdateMock).toHaveBeenCalledWith({
      where: { clientId: "device-client-id" },
      data: {
        grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
        redirectUris: [],
      },
    });
  });

  it("将受支持的提供者授权委托给 Better Auth", async () => {
    betterAuthHandlerMock.mockResolvedValueOnce(
      Response.json({ client_id: "client-1" }),
    );
    const request = new Request(
      "https://life.example/api/auth/oauth2/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "supported-client",
          grant_types: [
            OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
            OAUTH_REFRESH_TOKEN_GRANT_TYPE,
          ],
        }),
      },
    );

    const response = await authPostRoute(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ client_id: "client-1" });
    expect(betterAuthHandlerMock).toHaveBeenCalledWith(request);
    expect(oauthClientUpdateMock).not.toHaveBeenCalled();
  });
});
