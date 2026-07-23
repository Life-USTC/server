import { fail } from "@sveltejs/kit";
import { getAdminOAuthCopy } from "@/features/admin/lib/admin-oauth-page-copy";
import { requireAdminPage } from "@/features/admin/server/admin-page-data";
import type { AppLocale } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { logServerActionError } from "@/lib/log/app-logger";

export async function deleteAdminOAuthClientAction(
  request: Request,
  locale: AppLocale,
  requestId: string,
) {
  const copy = getAdminOAuthCopy(locale).oauth;
  await requireAdminPage(request, { requireActive: true });
  const form = await request.formData();
  const clientId = String(form.get("clientId") ?? "");
  if (!clientId) return fail(400, { message: copy.missingClientId });
  try {
    await prisma.oAuthClient.delete({ where: { clientId } });
  } catch (error) {
    if ((error as { code?: unknown }).code === "P2025") {
      return fail(404, { message: copy.deleteClientNotFound });
    }
    logServerActionError("admin.oauth-client.delete.failed", error, {
      action: "delete-client",
      requestId,
      route: "/admin/oauth",
    });
    return fail(500, { message: copy.deleteClientFailed });
  }
  return { message: copy.deleteSuccess };
}
