import * as z from "zod";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { TODO_CONTENT_MAX_LENGTH, TODO_TITLE_MAX_LENGTH } from "./todo-limits";
import { TODO_PRIORITY_VALUES } from "./todo-priority";

export const todoPrioritySchema = z.enum(TODO_PRIORITY_VALUES);

export const todoTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(TODO_TITLE_MAX_LENGTH);
export const todoContentSchema = z
  .string()
  .trim()
  .max(TODO_CONTENT_MAX_LENGTH)
  .optional()
  .nullable();
export const todoDueAtInputSchema = z.union([z.string(), z.null()]).optional();

export const todoCreateInputSchema = z.object({
  title: todoTitleSchema,
  content: todoContentSchema,
  priority: todoPrioritySchema.optional(),
  dueAt: todoDueAtInputSchema,
});

export const todoUpdateInputSchema = z.object({
  title: todoTitleSchema.optional(),
  content: todoContentSchema,
  priority: todoPrioritySchema.optional(),
  dueAt: todoDueAtInputSchema,
  completed: z.boolean().optional(),
});

export type TodoTitleValidationError = "required" | "too_long";
export type TodoContentValidationError = "too_long";
export type TodoDueAtValidationError = "invalid";

export function getTodoTitleValidationError(
  title: string,
): TodoTitleValidationError | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return "required";
  if (trimmedTitle.length > TODO_TITLE_MAX_LENGTH) return "too_long";
  return null;
}

export function getTodoContentValidationError(
  content: string,
): TodoContentValidationError | null {
  if (content.trim().length > TODO_CONTENT_MAX_LENGTH) return "too_long";
  return null;
}

export function parseTodoDueAtInput(value: unknown) {
  return parseDateInput(value);
}

export function getTodoDueAtValidationError(
  value: unknown,
): TodoDueAtValidationError | null {
  return parseTodoDueAtInput(value) === undefined ? "invalid" : null;
}
