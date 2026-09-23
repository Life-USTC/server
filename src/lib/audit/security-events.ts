import { getAuditRequestId } from "@/lib/audit/request-metadata";
import { logAppEvent } from "@/lib/log/app-logger";

export type AdminSecurityDenialReason =
  | "not_admin"
  | "rate_limit_unavailable"
  | "rate_limited"
  | "recent_auth_required"
  | "self_protection"
  | "suspended"
  | "unauthenticated";

function adminRouteClass(pathname: string) {
  if (pathname.startsWith("/api/admin/")) return "api_admin";
  if (pathname.startsWith("/admin/")) return "admin_page";
  return "unknown";
}

function adminMethod(method: string) {
  const normalized = method.toUpperCase();
  return ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"].includes(
    normalized,
  )
    ? normalized
    : "OTHER";
}

/**
 * Record an admin authorization or self-protection denial without creating a
 * database audit row. Anonymous requests cannot be safely attributed to an
 * AuditLog actor, so the structured security log is the source of truth.
 *
 * Keep this payload deliberately bounded: no cookie, token, body, email, IP,
 * or raw target identifier is included.
 */
export function logAdminSecurityEvent(
  request: Pick<Request, "headers" | "method" | "url">,
  reason: AdminSecurityDenialReason,
) {
  const pathname = new URL(request.url).pathname;
  logAppEvent(
    reason === "rate_limit_unavailable" ? "error" : "warn",
    "admin.authorization.denied",
    {
      event: "admin.authorization.denied",
      method: adminMethod(request.method),
      phase: "authorization",
      reason,
      requestId: getAuditRequestId(request),
      route: adminRouteClass(pathname),
      source: "security",
    },
  );
}
