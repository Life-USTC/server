import { getOAuthProtectedResourceMetadataUrl } from "./urls";

export const INVALID_TOKEN_ERROR = "invalid_token";
export const INSUFFICIENT_SCOPE_ERROR = "insufficient_scope";

export type AuthFailure = {
  error: string;
  status: number;
  description: string;
};

function buildBearerHeader({
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
      "WWW-Authenticate": buildBearerHeader({
        error: failure.error,
        description: failure.description,
        scopes,
      }),
    },
  });
}
