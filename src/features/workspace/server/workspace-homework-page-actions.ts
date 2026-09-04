import { fail, redirect } from "@sveltejs/kit";
import {
  getHomeworkDescriptionValidationError,
  getHomeworkTitleValidationError,
} from "@/features/homeworks/lib/homework-schema";
import {
  type CreateHomeworkInput,
  createHomeworkForSection,
} from "@/features/homeworks/server/homework-create";
import { homeworkDateError } from "@/features/homeworks/server/homework-dates";
import { parseOptionalLocalDateTime } from "@/features/workspace/server/workspace-form-dates";
import { getWorkspaceUserId } from "@/features/workspace/server/workspace-page-server";
import type { AppLocale } from "@/i18n/config";
import { getWorkspaceActionCopy } from "./workspace-action-copy";

type WorkspaceActionEvent = {
  locals: { locale: AppLocale };
  request: Request;
};

export async function createHomeworkWorkspaceAction({
  locals,
  request,
}: WorkspaceActionEvent) {
  const copy = getWorkspaceActionCopy(locals.locale).homeworks;
  const userId = await getWorkspaceUserId(request);
  if (!userId) return fail(401, { error: copy.errorUnauthorized });
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const titleError = getHomeworkTitleValidationError(title);
  if (titleError === "required") {
    return fail(400, { error: copy.errorTitleRequired });
  }
  if (titleError === "too_long") {
    return fail(400, { error: copy.errorTitleTooLong });
  }
  const description = String(form.get("description") ?? "").trim();
  if (getHomeworkDescriptionValidationError(description)) {
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
  const result = await createHomeworkForSection(userId, homeworkInput);
  if (!result.ok) {
    if (result.error === "suspended") {
      return fail(403, { error: copy.errorSuspended });
    }
    if (result.error === "forbidden") {
      return fail(403, { error: copy.errorUnauthorized });
    }
    return fail(404, { error: copy.errorSectionNotFound });
  }

  throw redirect(303, "/workspace/homeworks");
}
