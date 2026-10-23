import { decodeJwt, SignJWT } from "jose";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resolveDemoBoundary } from "@/features/demo/server/demo-request-boundary";
import {
  createDemoSession,
  readDemoSession,
} from "@/features/demo/server/demo-session";
import { hasDemoCookie } from "@/lib/auth/demo-request-signal";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";

const now = new Date("2026-09-24T01:00:00Z");
const secret = "demo-unit-secret-not-an-account-secret";
const cookieHeaders = (token: string) =>
  new Headers({ cookie: `life-ustc.demo=${token}` });

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", secret);
  vi.stubEnv("DEMO_ENABLED", "1");
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

it("signs a fifteen-minute fixture identity without an account identifier", async () => {
  const token = await createDemoSession(now);
  expect(decodeJwt(token)).toEqual({
    fixtureVersion: "todos-v1",
    iss: "life-ustc-demo",
    aud: "life-ustc-web-demo",
    iat: now.getTime() / 1000,
    exp: now.getTime() / 1000 + 900,
  });
  expect(await readDemoSession(cookieHeaders(token), now)).toEqual({
    fixtureVersion: "todos-v1",
    expiresAt: now.getTime() + 900_000,
  });
  expect(
    await readDemoSession(
      cookieHeaders(token),
      new Date(now.getTime() + 900_000),
    ),
  ).toBeNull();
  expect(
    await readDemoSession(cookieHeaders(token), new Date(now.getTime() - 1000)),
  ).toBeNull();
  expect(hasDemoCookie(cookieHeaders(token))).toBe(true);
  expect(hasRequestAuthSignal(cookieHeaders(token))).toBe(false);
});

it("rejects malformed, duplicated and tampered cookies", async () => {
  const token = await createDemoSession(now);
  for (const value of [
    "",
    "garbage",
    token.replace(/^./, "x"),
    token.slice(0, -8),
  ]) {
    expect(await readDemoSession(cookieHeaders(value), now)).toBeNull();
  }
  expect(
    await readDemoSession(
      new Headers({
        cookie: `life-ustc.demo=${token}; life-ustc.demo=${token}`,
      }),
      now,
    ),
  ).toBeNull();
});

it("rejects a JWT signed directly with the real authentication secret", async () => {
  const token = await new SignJWT({ fixtureVersion: "todos-v1" })
    .setProtectedHeader({ alg: "HS256", typ: "life-ustc-demo+jwt" })
    .setIssuer("life-ustc-demo")
    .setAudience("life-ustc-web-demo")
    .setIssuedAt(now.getTime() / 1000)
    .setExpirationTime(now.getTime() / 1000 + 900)
    .sign(new TextEncoder().encode(secret));
  expect(await readDemoSession(cookieHeaders(token), now)).toBeNull();
});

it("fails closed for old fixture versions and account claims even with a valid signature", async () => {
  // Independently produce otherwise valid tokens using the documented key context.
  const encoder = new TextEncoder();
  const source = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("life-ustc-demo-signing-v1"),
      info: encoder.encode("life-ustc-demo+jwt"),
    },
    source,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
  for (const claims of [
    { fixtureVersion: "todos-v0" },
    { fixtureVersion: "todos-v1", userId: "victim" },
  ]) {
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256", typ: "life-ustc-demo+jwt" })
      .setIssuer("life-ustc-demo")
      .setAudience("life-ustc-web-demo")
      .setIssuedAt(now.getTime() / 1000)
      .setExpirationTime(now.getTime() / 1000 + 900)
      .sign(key);
    expect(await readDemoSession(cookieHeaders(token), now)).toBeNull();
  }
});

it("requires the explicit gate and same origin to enter, and never converts an account", async () => {
  const request = (headers: HeadersInit = {}) =>
    new Request("https://life.test/account/demo/enter", {
      method: "POST",
      headers,
    });
  expect((await resolveDemoBoundary(request())).response?.status).toBe(403);
  expect(
    (await resolveDemoBoundary(request({ origin: "https://other.test" })))
      .response?.status,
  ).toBe(403);
  vi.stubEnv("DEMO_ENABLED", "");
  expect(
    (await resolveDemoBoundary(request({ origin: "https://life.test" })))
      .response?.status,
  ).toBe(404);
  vi.stubEnv("DEMO_ENABLED", "1");
  for (const headers of [
    { cookie: "better-auth.session_token=real" },
    { authorization: "Bearer real" },
    { cookie: `life-ustc.demo=${await createDemoSession(now)}` },
  ] as Record<string, string>[]) {
    expect(
      (
        await resolveDemoBoundary(
          request({ ...headers, origin: "https://life.test" }),
        )
      ).response?.status,
    ).toBe(403);
  }
  expect(
    await resolveDemoBoundary(request({ origin: "https://life.test" })),
  ).toEqual({ identity: null });
});

it("rejects encoded control aliases both at the hook and at the actual handler", async () => {
  const { POST } = await import("@/routes/account/demo/enter/+server");
  const set = vi.fn();
  for (const path of [
    "/account/%64emo/enter",
    "/account/demo/%65nter",
    "/account/demo/enter/",
  ]) {
    const url = new URL(path, "https://life.test");
    const request = new Request(url, { method: "POST" });
    expect((await resolveDemoBoundary(request)).response?.status).toBe(404);
    const response = await POST({ request, url, cookies: { set } } as never);
    expect(response.status).toBe(404);
  }
  expect(set).not.toHaveBeenCalled();
});
