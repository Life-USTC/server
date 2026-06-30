import { createRemoteJWKSet, jwtVerify } from "jose";
import { expandScopeClaim } from "@/lib/oauth/scope-registry";

export interface VerifiedAccessToken {
  sub: string;
  scope: Set<string>;
  aud: string | string[];
}

export async function verifyAccessTokenJwt(
  token: string,
  options: {
    jwksUrl: string;
    issuer: string | string[];
    audience: string | string[];
  },
): Promise<VerifiedAccessToken> {
  const JWKS = createRemoteJWKSet(new URL(options.jwksUrl));
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: options.issuer,
    audience: options.audience,
  });
  const sub = payload.sub;
  if (!sub) throw new Error("Missing sub claim");
  return {
    sub,
    scope: expandScopeClaim(payload.scope),
    aud: payload.aud ?? [],
  };
}
