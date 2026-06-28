import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCP_TOOLS_SCOPE } from "@/lib/oauth/constants";

const verifyOAuthAccessTokenMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthAccessToken: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  isOAuthDebugLogging: () => false,
  logOAuthDebug: vi.fn(),
}));

vi.mock("better-auth/oauth2", () => ({
  verifyAccessToken: verifyOAuthAccessTokenMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthMcpAudienceUrls: () => [
    "https://life.example/api/mcp",
    "https://life.example/api/auth/oauth2/userinfo",
    "https://life.example/api/auth",
  ],
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthProtectedResourceMetadataUrl: () =>
    new URL(
      "https://life.example/.well-known/oauth-protected-resource/api/mcp",
    ),
  getOAuthTokenVerificationIssuers: () => ["https://life.example/api/auth"],
}));

describe("MCP 认证", () => {
  beforeEach(() => {
    vi.resetModules();
    verifyOAuthAccessTokenMock.mockReset();
  });

  it("使用规范 OAuth issuer 校验 JWT access token", async () => {
    verifyOAuthAccessTokenMock.mockResolvedValue({
      azp: "client-id",
      aud: "https://life.example/api/mcp",
      exp: 1_900_000_000,
      scope: MCP_TOOLS_SCOPE,
      sub: "user-id",
    });
    const { verifyAccessToken } = await import("@/lib/mcp/auth");

    const authInfo = await verifyAccessToken(
      new Request("https://life.example/api/mcp"),
      "header.payload.signature",
    );

    expect(verifyOAuthAccessTokenMock).toHaveBeenCalledWith(
      "header.payload.signature",
      expect.objectContaining({
        jwksUrl: "https://life.example/api/auth/jwks",
        verifyOptions: {
          issuer: ["https://life.example/api/auth"],
          audience: [
            "https://life.example/api/mcp",
            "https://life.example/api/auth/oauth2/userinfo",
            "https://life.example/api/auth",
          ],
        },
      }),
    );
    expect(authInfo).toMatchObject({
      clientId: "client-id",
      scopes: [MCP_TOOLS_SCOPE],
      extra: { userId: "user-id" },
    });
  });
});
