import { fail } from "@sveltejs/kit";
import { getAdminOAuthCopy } from "@/features/admin/lib/admin-oauth-page-copy";
import { requireAdminPage } from "@/features/admin/server/admin-page-data";
import type { AppLocale } from "@/i18n/config";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { authPrisma as prisma } from "@/lib/db/auth-prisma";
import { logServerActionError } from "@/lib/log/app-logger";

export async function deleteAdminOAuthClientAction(
  request: Request,
  locale: AppLocale,
  requestId: string,
) {
  const copy = getAdminOAuthCopy(locale).oauth;
  const admin = await requireAdminPage(request, {
    requireActive: true,
    requireRecent: true,
  });
  const form = await request.formData();
  const clientId = String(form.get("clientId") ?? "");
  if (!clientId) {
    return fail(400, {
      message: copy.missingClientId,
      variant: "destructive" as const,
    });
  }
  try {
    await prisma.oAuthClient.delete({ where: { clientId } });
    await writeAuditLog({
      action: "admin_oauth_client_delete",
      channel: "web",
      userId: admin.id,
      requestId,
      targetId: clientId,
      targetType: "oauth_client",
    });
  } catch (error) {
    if ((error as { code?: unknown }).code === "P2025") {
      return fail(404, {
        message: copy.deleteClientNotFound,
        variant: "destructive" as const,
      });
    }
    logServerActionError("admin.oauth-client.delete.failed", error, {
      action: "delete-client",
      requestId,
      route: "/admin/oauth",
    });
    return fail(500, {
      message: copy.deleteClientFailed,
      variant: "destructive" as const,
    });
  }
  return { message: copy.deleteSuccess, variant: "default" as const };
}
