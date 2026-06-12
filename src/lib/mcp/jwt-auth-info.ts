import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { resourceIndicatorsMatch } from "@/lib/oauth/utils";

export function jwtClaimsToAuthInfo({
  mcpAudience,
  token,
  jwtClaims,
}: {
  jwtClaims: {
    aud?: unknown;
    azp?: unknown;
    exp?: unknown;
    scope?: unknown;
    sub?: unknown;
  };
  mcpAudience: string;
  token: string;
}): AuthInfo {
  const scopeValue = typeof jwtClaims.scope === "string" ? jwtClaims.scope : "";
  const scopes = scopeValue.split(" ").filter(Boolean);
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

  return {
    token,
    clientId: typeof jwtClaims.azp === "string" ? jwtClaims.azp : "unknown",
    scopes,
    expiresAt:
      typeof jwtClaims.exp === "number"
        ? jwtClaims.exp
        : Math.floor(Date.now() / 1000) + 60,
    resource: audValue ? new URL(audValue) : undefined,
    extra: {
      userId: typeof jwtClaims.sub === "string" ? jwtClaims.sub : undefined,
    },
  };
}
