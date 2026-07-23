import { createHmac, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getOptionalTrimmedEnv } from "@/app-env";

export const DEMO_SESSION_COOKIE = "life_ustc_demo";
export const DEMO_FIXTURE_VERSION = "2026-07-22";
const DEMO_ISSUER = "urn:life-ustc:demo";
const WEB_AUDIENCE = "urn:life-ustc:demo:web";
const API_AUDIENCE = "urn:life-ustc:demo:api";

export const DEMO_API_SCOPES = ["demo:todo:read", "demo:todo:write"] as const;
export type DemoApiScope = (typeof DEMO_API_SCOPES)[number];

export type DemoPrincipal = {
  kind: "demo";
  sessionId: string;
  fixtureVersion: string;
  scopes: Set<DemoApiScope>;
};

export function isDemoModeEnabled(input?: NodeJS.ProcessEnv) {
  return (
    getOptionalTrimmedEnv("DEMO_MODE_ENABLED", input)?.toLowerCase() === "true"
  );
}

function getSigningKey(input?: NodeJS.ProcessEnv) {
  const secret = getOptionalTrimmedEnv("DEMO_SIGNING_SECRET", input);
  if (!secret || secret.length < 32) {
    throw new Error("DEMO_SIGNING_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

async function mintDemoJwt(input: {
  audience: string;
  sessionId: string;
  scopes: readonly DemoApiScope[];
  ttl: string;
}) {
  return new SignJWT({
    demo: true,
    fixtureVersion: DEMO_FIXTURE_VERSION,
    scope: input.scopes.join(" "),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(DEMO_ISSUER)
    .setAudience(input.audience)
    .setSubject(input.sessionId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(input.ttl)
    .sign(getSigningKey());
}

export function mintDemoWebSession(sessionId: string = randomUUID()) {
  return mintDemoJwt({
    audience: WEB_AUDIENCE,
    sessionId,
    scopes: [],
    ttl: "15m",
  });
}

export function mintDemoApiToken(sessionId: string) {
  return mintDemoJwt({
    audience: API_AUDIENCE,
    sessionId,
    scopes: DEMO_API_SCOPES,
    ttl: "5m",
  });
}

async function verifyDemoJwt(
  token: string,
  audience: string,
): Promise<DemoPrincipal | null> {
  if (!isDemoModeEnabled()) return null;
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
      audience,
      issuer: DEMO_ISSUER,
    });
    if (
      payload.demo !== true ||
      typeof payload.sub !== "string" ||
      payload.fixtureVersion !== DEMO_FIXTURE_VERSION
    ) {
      return null;
    }
    const scopes = new Set(
      typeof payload.scope === "string"
        ? payload.scope
            .split(" ")
            .filter((scope): scope is DemoApiScope =>
              DEMO_API_SCOPES.includes(scope as DemoApiScope),
            )
        : [],
    );
    return {
      kind: "demo",
      sessionId: payload.sub,
      fixtureVersion: DEMO_FIXTURE_VERSION,
      scopes,
    };
  } catch {
    return null;
  }
}

export function verifyDemoWebSession(token: string) {
  return verifyDemoJwt(token, WEB_AUDIENCE);
}

export function verifyDemoApiToken(token: string) {
  return verifyDemoJwt(token, API_AUDIENCE);
}

export function getDemoSessionAuditId(sessionId: string) {
  return createHmac("sha256", getSigningKey())
    .update(sessionId)
    .digest("hex")
    .slice(0, 24);
}
