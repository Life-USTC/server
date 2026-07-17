import { verifyJwsAccessToken } from "better-auth/oauth2";
import type { JSONWebKeySet, JWTVerifyOptions } from "jose";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { expandScopeClaim } from "@/lib/oauth/scope-registry";

export interface VerifiedAccessToken {
  sub: string;
  scope: Set<string>;
  aud: string | string[];
  clientId?: string;
}

export async function verifyAccessTokenJwt(
  token: string,
  options: {
    jwksFetch?: () => Promise<JSONWebKeySet | undefined>;
    jwksUrl: string;
    issuer: string | string[];
    audience: string | string[];
  },
): Promise<VerifiedAccessToken> {
  const verifyOptions: JWTVerifyOptions &
    Required<Pick<JWTVerifyOptions, "issuer" | "audience">> = {
    issuer: options.issuer,
    audience: options.audience,
  };
  const payload = options.jwksFetch
    ? await verifyJwsAccessToken(token, {
        jwksFetch: options.jwksFetch,
        verifyOptions,
      })
    : (
        await jwtVerify(token, createRemoteJWKSet(new URL(options.jwksUrl)), {
          issuer: options.issuer,
          audience: options.audience,
        })
      ).payload;
  const sub = payload.sub;
  if (!sub) throw new Error("Missing sub claim");
  return {
    sub,
    scope: expandScopeClaim(payload.scope),
    aud: payload.aud ?? [],
    ...(typeof payload.azp === "string" ? { clientId: payload.azp } : {}),
  };
}
