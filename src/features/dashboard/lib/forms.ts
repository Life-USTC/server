type TodoFormCopy = {
  errorTitleRequired: string;
  errorTitleTooLong: string;
  errorContentTooLong: string;
  errorInvalidDueAt: string;
  saveFailed: string;
};

type HomeworkFormCopy = {
  errorTitleRequired: string;
  errorTitleTooLong: string;
  errorDescriptionTooLong: string;
  errorSectionNotFound: string;
  errorInvalidSubmissionDue: string;
  createFailed: string;
};

type TodoFormLimits = {
  titleMaxLength: number;
  contentMaxLength: number;
};

type HomeworkFormLimits = {
  titleMaxLength: number;
  descriptionMaxLength: number;
};

export function optionalDateTimeIsValid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return !text || !Number.isNaN(new Date(text).getTime());
}

export function actionResultError(
  result: { data?: { error?: unknown } },
  fallback: string,
) {
  return typeof result.data?.error === "string" && result.data.error.trim()
    ? result.data.error
    : fallback;
}

export function validateTodoForm(
  formData: FormData,
  copy: TodoFormCopy,
  limits: TodoFormLimits,
) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return copy.errorTitleRequired;
  if (title.length > limits.titleMaxLength) return copy.errorTitleTooLong;
  const content = String(formData.get("content") ?? "").trim();
  if (content.length > limits.contentMaxLength) {
    return copy.errorContentTooLong;
  }
  if (!optionalDateTimeIsValid(formData.get("dueAt"))) {
    return copy.errorInvalidDueAt;
  }
  return "";
}

export function validateCreateHomeworkForm(
  formData: FormData,
  copy: HomeworkFormCopy,
  limits: HomeworkFormLimits,
) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return copy.errorTitleRequired;
  if (title.length > limits.titleMaxLength) {
    return copy.errorTitleTooLong;
  }
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > limits.descriptionMaxLength) {
    return copy.errorDescriptionTooLong;
  }
  if (!String(formData.get("sectionId") ?? "").trim()) {
    return copy.errorSectionNotFound;
  }
  if (
    !optionalDateTimeIsValid(formData.get("publishedAt")) ||
    !optionalDateTimeIsValid(formData.get("submissionStartAt")) ||
    !optionalDateTimeIsValid(formData.get("submissionDueAt"))
  ) {
    return copy.errorInvalidSubmissionDue;
  }
  return "";
}
