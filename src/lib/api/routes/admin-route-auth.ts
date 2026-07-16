import {
  type AdminSession,
  resolveAdminByUserId,
} from "@/features/admin/server/admin-api";
import {
  handleRouteError,
  rateLimitResponse,
  suspensionForbidden,
  unauthorized,
} from "@/lib/api/helpers";
import { resolveApiUserId } from "@/lib/auth/api-auth";
import { findActiveSuspension } from "@/lib/auth/viewer-context";
import {
  checkUserMutationRateLimit,
  USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS,
} from "@/lib/security/user-mutation-rate-limit";

type AdminGuardOptions = {
  requireActive?: boolean;
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
  const userId = await resolveApiUserId(request);
  if (!userId) return unauthorized();

  const admin = await resolveAdminByUserId(userId);
  if (!admin) return unauthorized();

  if (options.requireActive) {
    const suspension = await findActiveSuspension(admin.userId);
    if (suspension) return suspensionForbidden(suspension.reason);
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    const url = new URL(request.url);
    const outcome = await checkUserMutationRateLimit({
      action: adminMutationRateLimitAction(url.pathname),
      host: url.host,
      userId: admin.userId,
    });
    if (!outcome.allowed) {
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
