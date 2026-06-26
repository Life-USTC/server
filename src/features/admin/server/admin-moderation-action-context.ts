import { fail } from "@sveltejs/kit";
import { requireAdminPage } from "@/features/admin/server/admin-page-data";
import type { AppLocale } from "@/i18n/config";
import { getAdminModerationPageCopy } from "./admin-moderation-page-copy";

export type AdminModerationActionEvent = {
  locals: {
    locale: string;
  };
  request: Request;
};

export async function getAdminModerationActionContext({
  locals,
  request,
}: AdminModerationActionEvent) {
  const copy = getAdminModerationPageCopy(
    locals.locale as AppLocale,
  ).moderation;
  const admin = await requireAdminPage(request, { requireActive: true });
  const form = await request.formData();

  return { admin, copy, form };
}

export function requiredModerationFormId(form: FormData, message: string) {
  const id = String(form.get("id") ?? "");
  if (!id) {
    return fail(400, { kind: "error", message });
  }
  return id;
}
