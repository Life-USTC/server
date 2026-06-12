import { fail, redirect } from "@sveltejs/kit";
import {
  getDashboardUserId,
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
  serializeOptionalLocalDateTime,
} from "@/features/dashboard/server/dashboard-page-server";
import type { AppLocale } from "@/i18n/config";
import { getDashboardActionCopy } from "./dashboard-action-copy";
import type { DashboardPageLoadEvent } from "./dashboard-page-load-types";

type DashboardActionEvent = Pick<DashboardPageLoadEvent, "locals" | "request">;

export async function createHomeworkDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale as AppLocale).homeworks;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.errorUnauthorized });
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return fail(400, { error: copy.errorTitleRequired });
  if (title.length > HOMEWORK_TITLE_MAX_LENGTH) {
    return fail(400, { error: copy.errorTitleTooLong });
  }
  const description = String(form.get("description") ?? "").trim();
  if (description.length > HOMEWORK_DESCRIPTION_MAX_LENGTH) {
    return fail(400, { error: copy.errorDescriptionTooLong });
  }
  const sectionId = Number(form.get("sectionId"));
  if (!Number.isInteger(sectionId)) {
    return fail(400, { error: copy.errorSectionNotFound });
  }
  const publishedAt = serializeOptionalLocalDateTime(form.get("publishedAt"));
  const submissionStartAt = serializeOptionalLocalDateTime(
    form.get("submissionStartAt"),
  );
  const submissionDueAt = serializeOptionalLocalDateTime(
    form.get("submissionDueAt"),
  );
  if (!publishedAt.ok || !submissionStartAt.ok || !submissionDueAt.ok) {
    return fail(400, { error: copy.errorInvalidSubmissionDue });
  }
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  const { postHomeworkRoute } = await import("@/lib/api/routes/homeworks");
  const response = await postHomeworkRoute(
    new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sectionId,
        title,
        description,
        publishedAt: publishedAt.value,
        submissionStartAt: submissionStartAt.value,
        submissionDueAt: submissionDueAt.value,
        isMajor: form.has("isMajor"),
        requiresTeam: form.has("requiresTeam"),
      }),
    }),
  );
  if (!response.ok) {
    return fail(response.status, { error: copy.createFailed });
  }
  throw redirect(303, "/dashboard/homeworks");
}
