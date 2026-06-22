import * as z from "zod";
import { parseDateInput } from "@/lib/time/parse-date-input";
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "./homework-limits";

export const homeworkTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(HOMEWORK_TITLE_MAX_LENGTH);

export const homeworkDescriptionInputSchema = z
  .string()
  .trim()
  .max(HOMEWORK_DESCRIPTION_MAX_LENGTH)
  .optional()
  .nullable();

export const homeworkDateInputSchema = z
  .union([z.string(), z.null()])
  .optional();

export type HomeworkTitleValidationError = "required" | "too_long";
export type HomeworkDescriptionValidationError = "too_long";
export type HomeworkDateValidationError = "invalid";

export function getHomeworkTitleValidationError(
  title: string,
): HomeworkTitleValidationError | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return "required";
  if (trimmedTitle.length > HOMEWORK_TITLE_MAX_LENGTH) return "too_long";
  return null;
}

export function getHomeworkDescriptionValidationError(
  description: string,
): HomeworkDescriptionValidationError | null {
  if (description.trim().length > HOMEWORK_DESCRIPTION_MAX_LENGTH) {
    return "too_long";
  }
  return null;
}

export function getHomeworkDateValidationError(
  value: unknown,
): HomeworkDateValidationError | null {
  return parseDateInput(value) === undefined ? "invalid" : null;
}
