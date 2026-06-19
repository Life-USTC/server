import { fail, redirect } from "@sveltejs/kit";
import {
  getDashboardUserId,
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
  parseOptionalLocalDateTime,
} from "@/features/dashboard/server/dashboard-page-server";
import {
  type CreateHomeworkInput,
  createHomeworkForSection,
} from "@/features/homeworks/server/homework-create";
import { homeworkDateError } from "@/features/homeworks/server/homework-dates";
import type { AppLocale } from "@/i18n/config";
import { getViewerAuthDataForUserId } from "@/lib/auth/viewer-context";
import { getDashboardActionCopy } from "./dashboard-action-copy";

type DashboardActionEvent = {
  locals: { locale: string };
  request: Request;
};

export async function createHomeworkDashboardAction({
  locals,
  request,
}: DashboardActionEvent) {
  const copy = getDashboardActionCopy(locals.locale as AppLocale).homeworks;
  const userId = await getDashboardUserId(request);
  if (!userId) return fail(401, { error: copy.errorUnauthorized });
  const viewerAuth = await getViewerAuthDataForUserId(userId);
  if (!viewerAuth) return fail(401, { error: copy.errorUnauthorized });
  if (viewerAuth.suspension) return fail(403, { error: copy.errorSuspended });
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
  const publishedAt = parseOptionalLocalDateTime(form.get("publishedAt"));
  const submissionStartAt = parseOptionalLocalDateTime(
    form.get("submissionStartAt"),
  );
  const submissionDueAt = parseOptionalLocalDateTime(
    form.get("submissionDueAt"),
  );
  if (!publishedAt.ok || !submissionStartAt.ok || !submissionDueAt.ok) {
    return fail(400, { error: copy.errorInvalidSubmissionDue });
  }
  const dateError = homeworkDateError({
    publishedAt: publishedAt.value,
    submissionDueAt: submissionDueAt.value,
    submissionStartAt: submissionStartAt.value,
  });
  if (dateError) {
    return fail(400, { error: copy.errorInvalidSubmissionDue });
  }

  const homeworkInput: CreateHomeworkInput = {
    sectionId,
    title,
    description,
    publishedAt: publishedAt.value,
    submissionStartAt: submissionStartAt.value,
    submissionDueAt: submissionDueAt.value,
    isMajor: form.has("isMajor"),
    requiresTeam: form.has("requiresTeam"),
  };
  const homework = await createHomeworkForSection(userId, homeworkInput);
  if (!homework) {
    return fail(404, { error: copy.errorSectionNotFound });
  }

  throw redirect(303, "/dashboard/homeworks");
}
