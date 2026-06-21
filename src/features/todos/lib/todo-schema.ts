import * as z from "zod";
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
