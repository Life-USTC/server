import {
  type AdminSession,
  resolveAdminByUserId,
} from "@/features/admin/server/admin-api";
import {
  handleRouteError,
  suspensionForbidden,
  unauthorized,
} from "@/lib/api/helpers";
import { resolveApiUserId } from "@/lib/auth/api-auth";
import { findActiveSuspension } from "@/lib/auth/viewer-context";

type AdminGuardOptions = {
  requireActive?: boolean;
};

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
