import { error, redirect } from "@sveltejs/kit";
import { logAdminSecurityEvent } from "@/lib/audit/security-events";
import {
  buildReauthenticationPageUrl,
  buildSignInPageUrl,
} from "@/lib/auth/auth-routing";
import { resolveAuthoritativeRecentSession } from "@/lib/auth/recent-session";
import { findActiveSuspension } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";

export async function getPrismaClient() {
  return prisma;
}

type AdminPageGuardOptions = {
  requireActive?: boolean;
  requireRecent?: boolean;
};

export async function requireAdminPage(
  request: Request,
  options: AdminPageGuardOptions = {},
) {
  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    logAdminSecurityEvent(request, "unauthenticated");
    const url = new URL(request.url);
    throw redirect(303, buildSignInPageUrl(`${url.pathname}${url.search}`));
  }

  const prisma = await getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true, name: true, username: true },
  });

  if (!user?.isAdmin) {
    logAdminSecurityEvent(request, "not_admin");
    error(403, "Forbidden");
  }
  if (options.requireActive) {
    const suspension = await findActiveSuspension(user.id);
    if (suspension) {
      logAdminSecurityEvent(request, "suspended");
      error(403, "Suspended");
    }
  }
  if (options.requireRecent) {
    const recent = await resolveAuthoritativeRecentSession(request.headers, {
      expectedUserId: user.id,
    });
    if (!recent.ok) {
      logAdminSecurityEvent(request, "recent_auth_required");
      const url = new URL(request.url);
      throw redirect(
        303,
        buildReauthenticationPageUrl(`${url.pathname}${url.search}`),
      );
    }
  }
  return user;
}
