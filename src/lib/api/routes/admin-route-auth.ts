import {
  type AdminSession,
  resolveAdminByUserId,
} from "@/features/admin/server/admin-api";
import {
  handleRouteError,
  rateLimitResponse,
  recentAuthenticationRequired,
  suspensionForbidden,
  unauthorized,
} from "@/lib/api/helpers";
import { logAdminSecurityEvent } from "@/lib/audit/security-events";
import { resolveSessionUserId } from "@/lib/auth/api-auth";
import { resolveAuthoritativeRecentSession } from "@/lib/auth/recent-session";
import { findActiveSuspension } from "@/lib/auth/viewer-context";
import {
  checkUserMutationRateLimit,
  USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS,
} from "@/lib/security/user-mutation-rate-limit";

type AdminGuardOptions = {
  /** When true, suspended admins may access the route. Defaults to false. */
  allowSuspended?: boolean;
  /** Require a server-authoritative session created within the recent-auth window. */
  requireRecent?: boolean;
};

const ADMIN_MUTATION_RESOURCES = new Set([
  "comments",
  "descriptions",
  "homeworks",
  "suspensions",
  "users",
]);

function adminMutationRateLimitAction(pathname: string) {
  const encodedResource = pathname.split("/").filter(Boolean)[2] ?? "";
  try {
    const resource = decodeURIComponent(encodedResource).toLowerCase();
    return `admin:${ADMIN_MUTATION_RESOURCES.has(resource) ? resource : "unknown"}:write`;
  } catch {
    return "admin:unknown:write";
  }
}

export async function requireAdminRequest(
  request: Request,
  options: AdminGuardOptions = {},
) {
  const userId = await resolveSessionUserId(request);
  if (!userId) {
    logAdminSecurityEvent(request, "unauthenticated");
    return unauthorized();
  }

  const admin = await resolveAdminByUserId(userId);
  if (!admin) {
    logAdminSecurityEvent(request, "not_admin");
    return unauthorized();
  }

  if (!options.allowSuspended) {
    const suspension = await findActiveSuspension(admin.userId);
    if (suspension) {
      logAdminSecurityEvent(request, "suspended");
      return suspensionForbidden(suspension.reason);
    }
  }

  if (options.requireRecent) {
    const recent = await resolveAuthoritativeRecentSession(request.headers, {
      expectedUserId: admin.userId,
    });
    if (!recent.ok) {
      logAdminSecurityEvent(request, "recent_auth_required");
      return recentAuthenticationRequired();
    }
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    const url = new URL(request.url);
    const outcome = await checkUserMutationRateLimit({
      action: adminMutationRateLimitAction(url.pathname),
      host: url.host,
      userId: admin.userId,
    });
    if (!outcome.allowed) {
      logAdminSecurityEvent(
        request,
        outcome.reason === "limited"
          ? "rate_limited"
          : "rate_limit_unavailable",
      );
      return rateLimitResponse(
        outcome.reason,
        USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS,
      );
    }
  }

  return admin;
}

export async function withAdminApiRoute(
  request: Request,
  errorMessage: string,
  handler: (admin: AdminSession) => Promise<Response>,
  options: AdminGuardOptions = {},
) {
  const admin = await requireAdminRequest(request, options);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    return await handler(admin);
  } catch (error) {
    return handleRouteError(errorMessage, error);
  }
}
