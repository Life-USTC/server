import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";

const findRefreshTokenMock = vi.fn();
const updateRefreshTokenMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthRefreshToken: {
      findUnique: findRefreshTokenMock,
      updateMany: updateRefreshTokenMock,
    },
  },
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: vi.fn(),
}));

vi.mock("@/lib/mcp/urls", () => ({
  getOAuthProviderValidAudiences: () => [
    "https://life.example/api/auth",
    "https://life.example/api/mcp",
  ],
}));

function base64UrlEncode(input: string) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unsignedJwt(payload: Record<string, unknown>) {
  return [
    base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" })),
    base64UrlEncode(JSON.stringify(payload)),
    "signature",
  ].join(".");
}

describe("OAuth refresh token resource persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    findRefreshTokenMock.mockReset();
    updateRefreshTokenMock.mockReset();
    updateRefreshTokenMock.mockResolvedValue({ count: 1 });
  });

  it("rejects refresh requests for resources outside the stored approval", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/auth"],
    });
    const { validateOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
      resource: "https://life.example/api/mcp",
    });

    const response = await validateOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: "invalid_target",
      error_description:
        "Requested resource is not approved for this refresh token",
    });
  });

  it("allows refresh requests for stored approved resources", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/mcp"],
    });
    const { validateOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
      resource: "https://life.example:443/api/mcp",
    });

    await expect(
      validateOAuthRefreshTokenResources(
        new Request("https://life.example/api/auth/oauth2/token"),
        params,
      ),
    ).resolves.toBeUndefined();
  });

  it("stores issued audience resources on authorization-code refresh tokens", async () => {
    const { persistOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      resource: "https://life.example:443/api/mcp",
    });
    const response = Response.json({
      access_token: unsignedJwt({ aud: "https://life.example/api/mcp" }),
      refresh_token: "issued-refresh-token",
    });

    await persistOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      response,
    );

    expect(updateRefreshTokenMock).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      data: { resources: ["https://life.example/api/mcp"] },
    });
  });

  it("does not store requested resources absent from the issued access-token audience", async () => {
    const { persistOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      resource: "https://life.example/api/mcp",
    });
    const response = Response.json({
      access_token: unsignedJwt({ aud: "https://life.example/api/auth" }),
      refresh_token: "issued-refresh-token",
    });

    await persistOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      response,
    );

    expect(updateRefreshTokenMock).not.toHaveBeenCalled();
  });

  it("copies existing approved resources when a refresh grant rotates the refresh token", async () => {
    findRefreshTokenMock.mockResolvedValue({
      resources: ["https://life.example/api/mcp"],
    });
    const { persistOAuthRefreshTokenResources } = await import(
      "@/lib/api/routes/auth-token-refresh-resources"
    );
    const params = new URLSearchParams({
      grant_type: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      refresh_token: "old-refresh-token",
    });
    const response = Response.json({ refresh_token: "new-refresh-token" });

    await persistOAuthRefreshTokenResources(
      new Request("https://life.example/api/auth/oauth2/token"),
      params,
      response,
    );

    expect(updateRefreshTokenMock).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      data: { resources: ["https://life.example/api/mcp"] },
    });
  });
});
