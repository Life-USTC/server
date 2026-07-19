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
    | "jwt_verify_failed"
    | "inactive_oauth_grant"
    | "opaque_token_miss"
    | "opaque_token_expired"
    | "opaque_token_missing_mcp_scope"
    | "token_resource_unbound"
    | "missing_feature_scope"
    | "missing_required_tool_scope";
  authHeaderKind: "missing" | "malformed" | "bearer";
  authTokenFormat: "missing" | "opaque" | "jwt" | "unknown";
  acceptedAudienceCount?: number;
  acceptedIssuerCount?: number;
  jwtErrorCode?: string;
  jwtErrorMessage?: string;
  jwtErrorName?: string;
  requiredScopeCount?: number;
  scopeCount?: number;
  tokenResourceMatchesMcp?: boolean;
  tokenResourcePresent?: boolean;
  toolNameCount?: number;
};

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
    `Bearer error="${error}"`,
    `error_description="${description}"`,
    `resource_metadata="${getOAuthProtectedResourceMetadataUrl().toString()}"`,
  ];

  if (scopes && scopes.length > 0) {
    parts.push(`scope="${scopes.join(" ")}"`);
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
