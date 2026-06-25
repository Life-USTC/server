import { beforeEach, describe, expect, it, vi } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";

const { betterAuthHandlerMock } = vi.hoisted(() => ({
  betterAuthHandlerMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    handler: betterAuthHandlerMock,
  },
}));

describe("OAuth registration route", () => {
  beforeEach(() => {
    betterAuthHandlerMock.mockReset();
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
  });

  it("rejects the custom device grant during Better Auth registration", async () => {
    const response = await authPostRoute(
      new Request("https://life.example/api/auth/oauth2/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "unsupported-device-client",
          grant_types: [OAUTH_DEVICE_CODE_GRANT_TYPE],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_client_metadata",
      error_description: `Unsupported grant type: ${OAUTH_DEVICE_CODE_GRANT_TYPE}`,
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
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
  });
});
