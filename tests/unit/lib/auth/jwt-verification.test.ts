import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";

const jwtVerifyMock = vi.fn();
const createRemoteJWKSetMock = vi.fn();

vi.mock("jose", () => ({
  jwtVerify: jwtVerifyMock,
  createRemoteJWKSet: createRemoteJWKSetMock,
}));

describe("verifyAccessTokenJwt", () => {
  beforeEach(() => {
    vi.resetModules();
    jwtVerifyMock.mockReset();
    createRemoteJWKSetMock.mockReset();
    createRemoteJWKSetMock.mockReturnValue("mock-jwks");
  });

  it("returns sub, scope, and aud from a verified JWT", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-1",
        scope: "workspace.todo:read workspace.todo:write",
        aud: "https://life.example/api/auth",
        azp: "client-1",
        [OAUTH_GRANT_ID_CLAIM]: "consent-1",
      },
    });

    const { verifyAccessTokenJwt } = await import(
      "@/lib/auth/jwt-verification"
    );
    const result = await verifyAccessTokenJwt("token", {
      jwksUrl: "https://life.example/api/auth/jwks",
      issuer: "https://life.example/api/auth",
      audience: "https://life.example/api/auth",
    });

    expect(result.sub).toBe("user-1");
    expect(result.scope).toEqual(
      new Set(["workspace.todo:read", "workspace.todo:write"]),
    );
    expect(result.aud).toBe("https://life.example/api/auth");
    expect(result.clientId).toBe("client-1");
    expect(result.grantId).toBe("consent-1");
    expect(result.tokenScopes).toEqual([
      "workspace.todo:read",
      "workspace.todo:write",
    ]);
    expect(createRemoteJWKSetMock).toHaveBeenCalledWith(
      new URL("https://life.example/api/auth/jwks"),
    );
    expect(jwtVerifyMock).toHaveBeenCalledWith("token", "mock-jwks", {
      issuer: "https://life.example/api/auth",
      audience: "https://life.example/api/auth",
    });
  });

  it("does not expand a legacy coarse read scope", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-1",
        scope: "rest:read",
      },
    });

    const { verifyAccessTokenJwt } = await import(
      "@/lib/auth/jwt-verification"
    );
    const result = await verifyAccessTokenJwt("token", {
      jwksUrl: "https://life.example/api/auth/jwks",
      issuer: "https://life.example/api/auth",
      audience: "https://life.example/api/auth",
    });

    expect(result.scope).toEqual(new Set(["rest:read"]));
    expect(result.scope.has("admin:read")).toBe(false);
    expect(result.scope.has("workspace.todo:write")).toBe(false);
  });

  it("does not expand a legacy coarse write scope", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-1",
        scope: "rest:write",
      },
    });

    const { verifyAccessTokenJwt } = await import(
      "@/lib/auth/jwt-verification"
    );
    const result = await verifyAccessTokenJwt("token", {
      jwksUrl: "https://life.example/api/auth/jwks",
      issuer: "https://life.example/api/auth",
      audience: "https://life.example/api/auth",
    });

    expect(result.scope).toEqual(new Set(["rest:write"]));
    expect(result.scope.has("admin:write")).toBe(false);
    expect(result.scope.has("workspace.todo:read")).toBe(false);
  });

  it("throws when the sub claim is missing", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: { scope: "workspace.todo:read" },
    });

    const { verifyAccessTokenJwt } = await import(
      "@/lib/auth/jwt-verification"
    );

    await expect(
      verifyAccessTokenJwt("token", {
        jwksUrl: "https://life.example/api/auth/jwks",
        issuer: "https://life.example/api/auth",
        audience: "https://life.example/api/auth",
      }),
    ).rejects.toThrow("Missing sub claim");
  });

  it("supports array scope, issuer, and audience values", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-1",
        scope: ["workspace.todo:read"],
        aud: ["aud1", "aud2"],
      },
    });

    const { verifyAccessTokenJwt } = await import(
      "@/lib/auth/jwt-verification"
    );
    const result = await verifyAccessTokenJwt("token", {
      jwksUrl: "https://life.example/api/auth/jwks",
      issuer: ["iss1", "iss2"],
      audience: ["aud1", "aud2"],
    });

    expect(result.sub).toBe("user-1");
    expect(result.scope).toEqual(new Set(["workspace.todo:read"]));
    expect(result.aud).toEqual(["aud1", "aud2"]);
    expect(jwtVerifyMock).toHaveBeenCalledWith("token", "mock-jwks", {
      issuer: ["iss1", "iss2"],
      audience: ["aud1", "aud2"],
    });
  });

  it("falls back to an empty array when aud is absent", async () => {
    jwtVerifyMock.mockResolvedValue({
      payload: {
        sub: "user-1",
        scope: "workspace.todo:read",
      },
    });

    const { verifyAccessTokenJwt } = await import(
      "@/lib/auth/jwt-verification"
    );
    const result = await verifyAccessTokenJwt("token", {
      jwksUrl: "https://life.example/api/auth/jwks",
      issuer: "https://life.example/api/auth",
      audience: "https://life.example/api/auth",
    });

    expect(result.aud).toEqual([]);
  });
});
