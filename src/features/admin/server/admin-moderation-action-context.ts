import { fail } from "@sveltejs/kit";
import type { AppLocale } from "@/i18n/config";
import { requireAdminPage } from "@/lib/admin-page-data";
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
  const admin = await requireAdminPage(request);
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
