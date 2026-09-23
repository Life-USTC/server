import {
  getHomeworkDateValidationError,
  getHomeworkDescriptionValidationError,
  getHomeworkTitleValidationError,
} from "@/features/homeworks/lib/homework-schema";
import {
  getTodoContentValidationError,
  getTodoDueAtValidationError,
  getTodoTitleValidationError,
} from "@/features/todos/lib/todo-schema";

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

export function actionResultError(
  result: { data?: { error?: unknown } },
  fallback: string,
) {
  return typeof result.data?.error === "string" && result.data.error.trim()
    ? result.data.error
    : fallback;
}

export function validateTodoForm(formData: FormData, copy: TodoFormCopy) {
  const title = String(formData.get("title") ?? "").trim();
  const titleError = getTodoTitleValidationError(title);
  if (titleError === "required") return copy.errorTitleRequired;
  if (titleError === "too_long") return copy.errorTitleTooLong;
  const content = String(formData.get("content") ?? "").trim();
  if (getTodoContentValidationError(content)) {
    return copy.errorContentTooLong;
  }
  if (getTodoDueAtValidationError(formData.get("dueAt"))) {
    return copy.errorInvalidDueAt;
  }
  return "";
}

export function validateCreateHomeworkForm(
  formData: FormData,
  copy: HomeworkFormCopy,
) {
  const title = String(formData.get("title") ?? "").trim();
  const titleError = getHomeworkTitleValidationError(title);
  if (titleError === "required") return copy.errorTitleRequired;
  if (titleError === "too_long") {
    return copy.errorTitleTooLong;
  }
  const description = String(formData.get("description") ?? "").trim();
  if (getHomeworkDescriptionValidationError(description)) {
    return copy.errorDescriptionTooLong;
  }
  if (!String(formData.get("sectionId") ?? "").trim()) {
    return copy.errorSectionNotFound;
  }
  if (
    getHomeworkDateValidationError(formData.get("publishedAt")) ||
    getHomeworkDateValidationError(formData.get("submissionStartAt")) ||
    getHomeworkDateValidationError(formData.get("submissionDueAt"))
  ) {
    return copy.errorInvalidSubmissionDue;
  }
  return "";
}
