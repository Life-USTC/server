import type { Cookies } from "@sveltejs/kit";
import { jwtVerify, SignJWT } from "jose";
import {
  DEMO_FIXTURE_VERSION,
  type DemoIdentity,
} from "@/features/demo/lib/demo-types";
import { DEMO_COOKIE_NAME } from "@/lib/auth/demo-request-signal";
import { getOptionalTrimmedEnv } from "@/lib/ports/env";

const ISSUER = "life-ustc-demo";
const AUDIENCE = "life-ustc-web-demo";
const TOKEN_TYPE = "life-ustc-demo+jwt";
export const DEMO_SESSION_SECONDS = 15 * 60;

export function isDemoEnabled() {
  return getOptionalTrimmedEnv("DEMO_ENABLED") === "1";
}

async function signingKey() {
  const secret = getOptionalTrimmedEnv("AUTH_SECRET");
  if (!secret) throw new Error("AUTH_SECRET is required for demo sessions");
  const encoder = new TextEncoder();
  const source = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("life-ustc-demo-signing-v1"),
      info: encoder.encode(TOKEN_TYPE),
    },
    source,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

export async function createDemoSession(now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ fixtureVersion: DEMO_FIXTURE_VERSION })
    .setProtectedHeader({ alg: "HS256", typ: TOKEN_TYPE })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + DEMO_SESSION_SECONDS)
    .sign(await signingKey());
}

export async function readDemoSession(
  headers: Headers,
  now = new Date(),
): Promise<DemoIdentity | null> {
  const parts = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.split("=", 1)[0] === DEMO_COOKIE_NAME);
  if (parts.length !== 1) return null;
  const token = parts[0].slice(DEMO_COOKIE_NAME.length + 1);
  if (!token || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, await signingKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      typ: TOKEN_TYPE,
      currentDate: now,
      maxTokenAge: DEMO_SESSION_SECONDS,
      requiredClaims: ["iat", "exp", "fixtureVersion"],
    });
    if (
      payload.fixtureVersion !== DEMO_FIXTURE_VERSION ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp !== (payload.iat ?? 0) + DEMO_SESSION_SECONDS ||
      Object.keys(payload).some(
        (key) => !["iat", "exp", "iss", "aud", "fixtureVersion"].includes(key),
      )
    ) {
      return null;
    }
    return {
      fixtureVersion: DEMO_FIXTURE_VERSION,
      expiresAt: (payload.exp ?? 0) * 1000,
    };
  } catch {
    return null;
  }
}

export function setDemoCookie(cookies: Cookies, token: string, url: URL) {
  cookies.set(DEMO_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    maxAge: DEMO_SESSION_SECONDS,
  });
}
