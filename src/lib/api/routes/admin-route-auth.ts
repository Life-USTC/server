import {
  type AdminSession,
  resolveAdminByUserId,
} from "@/features/admin/server/admin-api";
import { handleRouteError, unauthorized } from "@/lib/api/helpers";
import { resolveSessionUserId } from "@/lib/auth/api-auth";

export async function requireAdminRequest(request: Request) {
  const userId = await resolveSessionUserId(request);
  if (!userId) return unauthorized();

  const admin = await resolveAdminByUserId(userId);
  return admin ?? unauthorized();
}

export async function withAdminApiRoute(
  request: Request,
  errorMessage: string,
  handler: (admin: AdminSession) => Promise<Response>,
) {
  const admin = await requireAdminRequest(request);
  if (admin instanceof Response) {
    return admin;
  }

  try {
    return await handler(admin);
  } catch (error) {
    return handleRouteError(errorMessage, error);
  }
}
