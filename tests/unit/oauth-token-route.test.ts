import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenGetRoute, tokenPostRoute } from "@/lib/api/routes/auth-token";

const { betterAuthHandlerMock, findRefreshTokenMock, updateRefreshTokenMock } =
  vi.hoisted(() => ({
    betterAuthHandlerMock: vi.fn(),
    findRefreshTokenMock: vi.fn(),
    updateRefreshTokenMock: vi.fn(),
  }));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    handler: betterAuthHandlerMock,
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthRefreshToken: {
      findUnique: findRefreshTokenMock,
      updateMany: updateRefreshTokenMock,
    },
  },
}));

vi.mock("@/lib/mcp/urls", () => ({
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthProviderValidAudiences: () => [
    "https://life.example/api/auth",
    "https://life.example/api/mcp",
  ],
}));

describe("OAuth token route", () => {
  beforeEach(() => {
    betterAuthHandlerMock.mockReset();
    findRefreshTokenMock.mockReset();
    updateRefreshTokenMock.mockReset();
  });

  it("returns JSON method guidance for GET", async () => {
    const response = await tokenGetRoute(
      new Request("http://localhost/api/auth/oauth2/token"),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toEqual({
      error: "invalid_request",
      error_description: "Use POST to exchange OAuth grants.",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
  });

  it("normalizes delegated Better Auth validation errors", async () => {
    betterAuthHandlerMock.mockResolvedValueOnce(
      Response.json(
        {
          message: "[body.grant_type] Invalid option",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      ),
    );

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=unsupported",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_request",
      error_description: "[body.grant_type] Invalid option",
    });
  });

  it("preserves delegated OAuth error headers", async () => {
    betterAuthHandlerMock.mockResolvedValueOnce(
      Response.json(
        {
          message: "Invalid client credentials",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
            "Content-Length": "999",
            "WWW-Authenticate": 'Basic realm="OAuth token"',
          },
        },
      ),
    );

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="OAuth token"',
    );
    expect(await response.json()).toEqual({
      error: "invalid_client",
      error_description: "Invalid client credentials",
    });
  });

  it("rejects unapproved refresh-token resources before delegation", async () => {
    findRefreshTokenMock.mockResolvedValueOnce({
      resources: ["https://life.example/api/auth"],
    });

    const response = await tokenPostRoute(
      new Request("http://localhost/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "old-refresh-token",
          resource: "https://life.example/api/mcp",
        }).toString(),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_target",
      error_description:
        "Requested resource is not approved for this refresh token",
    });
    expect(betterAuthHandlerMock).not.toHaveBeenCalled();
  });
});
