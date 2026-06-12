import { handleRouteError, unauthorized } from "@/lib/api/helpers";
import { resolveApiUserId } from "@/lib/auth/api-auth";

export type AdminSession = {
  userId: string;
};

export async function resolveAdminByUserId(
  userId: string | null | undefined,
): Promise<AdminSession | null> {
  if (!userId) return null;

  const { prisma } = await import("@/lib/db/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isAdmin: true },
  });

  if (!user?.isAdmin) {
    return null;
  }

  return { userId: user.id };
}

export async function requireAdminRequest(request: Request) {
  const userId = await resolveApiUserId(request);
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
