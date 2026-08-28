import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { expandScopeClaim } from "@/lib/oauth/scope-registry";
import { resourceIndicatorsMatch } from "@/lib/oauth/utils";

export function jwtClaimsToAuthInfo({
  mcpAudience,
  token,
  jwtClaims,
}: {
  jwtClaims: {
    aud?: unknown;
    azp?: unknown;
    client_id?: unknown;
    exp?: unknown;
    scope?: unknown;
    sid?: unknown;
    sub?: unknown;
    [OAUTH_GRANT_ID_CLAIM]?: unknown;
  };
  mcpAudience: string;
  token: string;
}): AuthInfo {
  const scopes = Array.from(expandScopeClaim(jwtClaims.scope));
  const aud = jwtClaims.aud;
  let audValue = "";
  if (typeof aud === "string") {
    audValue = aud;
  } else if (Array.isArray(aud)) {
    const mcpMatch = aud.find(
      (a) => typeof a === "string" && resourceIndicatorsMatch(a, mcpAudience),
    );
    audValue = mcpMatch ?? String(aud[0] ?? "");
  }

  const azp = typeof jwtClaims.azp === "string" ? jwtClaims.azp : undefined;
  const clientId =
    typeof jwtClaims.client_id === "string" ? jwtClaims.client_id : undefined;

  return {
    token,
    clientId:
      azp && clientId && azp !== clientId
        ? "unknown"
        : (clientId ?? azp ?? "unknown"),
    scopes,
    expiresAt:
      typeof jwtClaims.exp === "number"
        ? jwtClaims.exp
        : Math.floor(Date.now() / 1000) + 60,
    resource: audValue ? new URL(audValue) : undefined,
    extra: {
      userId: typeof jwtClaims.sub === "string" ? jwtClaims.sub : undefined,
      grantId:
        typeof jwtClaims[OAUTH_GRANT_ID_CLAIM] === "string"
          ? jwtClaims[OAUTH_GRANT_ID_CLAIM]
          : undefined,
      sessionId: typeof jwtClaims.sid === "string" ? jwtClaims.sid : undefined,
    },
  };
}
