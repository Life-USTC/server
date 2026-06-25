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

describe("OAuth registration route", () => {
  beforeEach(() => {
    betterAuthHandlerMock.mockReset();
    oauthClientUpdateMock.mockReset();
  });

  it("rejects client_credentials during dynamic client registration", async () => {
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

  it("registers the custom device grant through the Better Auth adapter", async () => {
    betterAuthHandlerMock.mockImplementationOnce(async (request: Request) => {
      expect(await request.json()).toMatchObject({
        client_name: "device-client",
        grant_types: [OAUTH_REFRESH_TOKEN_GRANT_TYPE],
      });
      return Response.json(
        {
          client_id: "device-client-id",
          client_name: "device-client",
          grant_types: [OAUTH_REFRESH_TOKEN_GRANT_TYPE],
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
    });
    expect(oauthClientUpdateMock).toHaveBeenCalledWith({
      where: { clientId: "device-client-id" },
      data: { grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE] },
    });
  });

  it("delegates supported provider grants to Better Auth", async () => {
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
