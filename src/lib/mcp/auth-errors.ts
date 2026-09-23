import { getOAuthProtectedResourceMetadataUrl } from "./urls";

export const INVALID_TOKEN_ERROR = "invalid_token";
export const INSUFFICIENT_SCOPE_ERROR = "insufficient_scope";

export type AuthFailure = {
  diagnostics: McpAuthFailureDiagnostics;
  error: string;
  status: number;
  description: string;
};

export type McpAuthFailureDiagnostics = {
  authFailureKind:
    | "missing_bearer"
    | "malformed_authorization_header"
    | "unsupported_dpop"
    | "upstream_auth_rejected"
    | "jwt_verify_failed"
    | "inactive_oauth_grant"
    | "opaque_token_miss"
    | "opaque_token_expired"
    | "opaque_token_missing_mcp_scope"
    | "token_resource_unbound"
    | "missing_feature_scope"
    | "missing_required_tool_scope";
  authHeaderKind: "missing" | "malformed" | "bearer" | "dpop";
  authTokenFormat: "missing" | "opaque" | "jwt" | "unknown";
  acceptedAudienceCount?: number;
  acceptedIssuerCount?: number;
  jwtErrorCode?: string;
  jwtErrorName?: string;
  requiredScopeCount?: number;
  scopeCount?: number;
  tokenResourceMatchesMcp?: boolean;
  tokenResourcePresent?: boolean;
  toolNameCount?: number;
};

function quoteBearerParameter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      throw new TypeError(
        "Bearer challenge values must not contain control characters",
      );
    }
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildBearerChallenge({
  error,
  description,
  scopes,
}: {
  error: string;
  description: string;
  scopes?: string[];
}) {
  const parts = [
    `Bearer error=${quoteBearerParameter(error)}`,
    `error_description=${quoteBearerParameter(description)}`,
    `resource_metadata=${quoteBearerParameter(getOAuthProtectedResourceMetadataUrl().toString())}`,
  ];

  if (scopes && scopes.length > 0) {
    parts.push(`scope=${quoteBearerParameter(scopes.join(" "))}`);
  }

  return parts.join(", ");
}

export function buildAuthErrorResponse(
  failure: AuthFailure,
  scopes?: string[],
) {
  return new Response(JSON.stringify({ error: failure.error }), {
    status: failure.status,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": buildBearerChallenge({
        error: failure.error,
        description: failure.description,
        scopes,
      }),
    },
  });
}
