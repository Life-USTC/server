import { fail } from "@sveltejs/kit";
import type { AppLocale } from "@/i18n/config";
import { requireAdminPage } from "@/lib/admin-page-data";
import { getAdminOAuthCopy } from "./admin-oauth-page-copy";

export async function deleteAdminOAuthClientAction(
  request: Request,
  locale: AppLocale,
) {
  const copy = getAdminOAuthCopy(locale).oauth;
  await requireAdminPage(request);
  const form = await request.formData();
  const clientId = String(form.get("clientId") ?? "");
  if (!clientId) return fail(400, { message: copy.missingClientId });
  const { prisma } = await import("@/lib/db/prisma");
  try {
    await prisma.oAuthClient.delete({ where: { clientId } });
  } catch (error) {
    if ((error as { code?: unknown }).code === "P2025") {
      return fail(404, { message: copy.deleteClientNotFound });
    }
    return fail(500, { message: copy.deleteClientFailed });
  }
  return { message: copy.deleteSuccess };
}
