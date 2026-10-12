import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { verifyAccessTokenJwt } from "@/lib/auth/jwt-verification";
import { getLocalJwksVerificationOptions } from "@/lib/auth/local-jwks";

const { getJwks } = vi.hoisted(() => ({ getJwks: vi.fn() }));
vi.mock("@/lib/auth/core", () => ({ authApi: { getJwks } }));

const issuer = "https://life.example/api/auth";
const audience = "https://life.example/api/graphql";

async function signingKey(kid: string) {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA");
  const jwks = {
    keys: [{ ...(await exportJWK(publicKey)), kid, alg: "EdDSA" }],
  };
  const token = await new SignJWT({ scope: "workspace.todo:read" })
    .setProtectedHeader({ alg: "EdDSA", kid })
    .setSubject("user-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime("1h")
    .sign(privateKey);
  return { jwks, token };
}

function verify(token: string, binding?: object) {
  return runWithCloudflareRuntimeEnv(
    binding ? { HYPERDRIVE_AUTH: binding } : {},
    () =>
      verifyAccessTokenJwt(token, {
        ...getLocalJwksVerificationOptions(),
        jwksUrl: `${issuer}/jwks`,
        issuer,
        audience,
      }),
  );
}

describe("local JWKS verification cache", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
    getJwks.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("reuses public keys across request contexts and still verifies signatures", async () => {
    const key = await signingKey("current");
    const forged = await signingKey("current");
    const binding = {};
    getJwks.mockResolvedValue(key.jwks);
    await expect(verify(key.token, binding)).resolves.toMatchObject({
      sub: "user-1",
    });
    await expect(verify(key.token, binding)).resolves.toMatchObject({
      sub: "user-1",
    });
    await expect(verify(forged.token, binding)).rejects.toThrow();
    expect(getJwks).toHaveBeenCalledTimes(1);
  });

  it("isolates keyrings even when their key IDs are equal", async () => {
    const a = await signingKey("same-id");
    const b = await signingKey("same-id");
    const bindingA = {};
    const bindingB = {};
    getJwks.mockResolvedValueOnce(a.jwks).mockResolvedValueOnce(b.jwks);
    await expect(verify(a.token, bindingA)).resolves.toMatchObject({
      sub: "user-1",
    });
    await expect(verify(a.token, bindingB)).rejects.toThrow();
    await expect(verify(b.token, bindingB)).resolves.toMatchObject({
      sub: "user-1",
    });
    await expect(verify(b.token, bindingA)).rejects.toThrow();
    expect(getJwks).toHaveBeenCalledTimes(2);
  });

  it("refreshes on rotation and expires the cached key set after five minutes", async () => {
    const oldKey = await signingKey("old");
    const newKey = await signingKey("new");
    const binding = {};
    getJwks.mockResolvedValueOnce(oldKey.jwks).mockResolvedValue(newKey.jwks);
    await verify(oldKey.token, binding);
    await expect(verify(newKey.token, binding)).resolves.toMatchObject({
      sub: "user-1",
    });
    expect(getJwks).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2026-10-13T00:04:59.999Z"));
    await verify(newKey.token, binding);
    expect(getJwks).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2026-10-13T00:05:00Z"));
    await verify(newKey.token, binding);
    expect(getJwks).toHaveBeenCalledTimes(3);
  });

  it("fails closed on an expired-cache fetch failure and recovers on the next request", async () => {
    const key = await signingKey("current");
    const binding = {};
    getJwks
      .mockResolvedValueOnce(key.jwks)
      .mockRejectedValueOnce(new Error("JWKS unavailable"))
      .mockResolvedValue(key.jwks);
    await verify(key.token, binding);
    vi.setSystemTime(new Date("2026-10-13T00:05:00Z"));
    await expect(verify(key.token, binding)).rejects.toThrow(
      "JWKS unavailable",
    );
    await expect(verify(key.token, binding)).resolves.toMatchObject({
      sub: "user-1",
    });
    expect(getJwks).toHaveBeenCalledTimes(3);
  });

  it("does not share keys without an explicit auth database identity", async () => {
    const key = await signingKey("current");
    getJwks.mockResolvedValue(key.jwks);
    await verify(key.token);
    await verify(key.token);
    expect(getJwks).toHaveBeenCalledTimes(2);
  });
});
