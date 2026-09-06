import {
  revokeUserOAuthAuthorization,
  updateUserOAuthAuthorizationScopes,
} from "@/features/oauth/server/user-authorizations.server";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { resolveAuthoritativeRecentSession } from "@/lib/auth/recent-session";

export function oauthConsentMutationPath(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/auth/oauth2/delete-consent") return "delete";
  if (pathname === "/api/auth/oauth2/update-consent") return "update";
  if (pathname === "/api/auth/oauth2/consent") return "provider-consent";
  return null;
}

function consentMutationError(status: number, message: string) {
  const code =
    status === 401
      ? "UNAUTHORIZED"
      : status === 403
        ? "FORBIDDEN"
        : status === 404
          ? "NOT_FOUND"
          : "BAD_REQUEST";
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function handleOAuthConsentMutation(
  request: Request,
  mutation: "delete" | "provider-consent" | "update",
) {
  if (mutation === "provider-consent") {
    return consentMutationError(
      404,
      "OAuth consent is only available through the authorization page",
    );
  }

  const origin =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin || origin === "null" || !isTrustedAuthOrigin(origin)) {
    return consentMutationError(403, "Invalid origin");
  }

  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user.id) {
    return consentMutationError(401, "Authentication required");
  }
  const recent = await resolveAuthoritativeRecentSession(request.headers, {
    expectedUserId: session.user.id,
  });
  if (!recent.ok) {
    await fireAuditLog({
      action:
        mutation === "delete"
          ? "oauth_authorization_revoke"
          : "oauth_authorization_update",
      channel: "auth",
      outcome: "denied",
      subjectUserId: session.user.id,
      targetType: "oauth_consent",
      userId: session.user.id,
      ...(recent.sessionId ? { sessionId: recent.sessionId } : {}),
      metadata: { reason: recent.reason },
      ...getAuditRequestMetadata(request),
    });
    return consentMutationError(403, "Recent authentication required");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return consentMutationError(400, "Invalid JSON request body");
  }
  const input =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const consentId = typeof input?.id === "string" ? input.id : "";
  if (!consentId) return consentMutationError(400, "Missing consent id");

  if (mutation === "delete") {
    const result = await revokeUserOAuthAuthorization(
      session.user.id,
      consentId,
      {
        ...getAuditRequestMetadata(request),
        channel: "auth",
        sessionId: recent.sessionId,
      },
    );
    return result.ok
      ? Response.json(null, { headers: { "Cache-Control": "no-store" } })
      : consentMutationError(404, "OAuth authorization not found");
  }

  const update =
    input?.update && typeof input.update === "object"
      ? (input.update as Record<string, unknown>)
      : null;
  if (
    !Array.isArray(update?.scopes) ||
    !update.scopes.every((scope) => typeof scope === "string")
  ) {
    return consentMutationError(400, "Invalid OAuth scopes");
  }
  const result = await updateUserOAuthAuthorizationScopes(
    session.user.id,
    consentId,
    update.scopes,
    {
      ...getAuditRequestMetadata(request),
      channel: "auth",
      sessionId: recent.sessionId,
    },
  );
  if (!result.ok) {
    return consentMutationError(
      result.reason === "not_found" ? 404 : 400,
      result.reason === "not_found"
        ? "OAuth authorization not found"
        : "Invalid OAuth scopes",
    );
  }
  return Response.json(
    { id: result.consentId, scopes: result.scopes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
