import { verifyJwsAccessToken } from "better-auth/oauth2";
import type { JSONWebKeySet, JWTVerifyOptions } from "jose";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { expandScopeClaim } from "@/lib/oauth/scope-registry";

export interface VerifiedAccessToken {
  sub: string;
  scope: Set<string>;
  tokenScopes: string[];
  aud: string | string[];
  clientId?: string;
  grantId?: string;
}

function getTokenScopes(scope: unknown): string[] {
  if (typeof scope === "string") {
    return [...new Set(scope.split(/\s+/).filter(Boolean))];
  }
  if (Array.isArray(scope)) {
    return [
      ...new Set(
        scope.filter((value): value is string => typeof value === "string"),
      ),
    ];
  }
  return [];
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
    tokenScopes: getTokenScopes(payload.scope),
    aud: payload.aud ?? [],
    ...(typeof payload.azp === "string" ? { clientId: payload.azp } : {}),
    ...(typeof payload[OAUTH_GRANT_ID_CLAIM] === "string"
      ? { grantId: payload[OAUTH_GRANT_ID_CLAIM] }
      : {}),
  };
}
