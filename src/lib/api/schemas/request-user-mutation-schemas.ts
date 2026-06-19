import * as z from "zod";
import {
  TODO_CONTENT_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/todos/lib/todo-limits";
import { APP_LOCALES } from "@/i18n/config";
import { todoPrioritySchema } from "./request-schema-primitives";

export const calendarSubscriptionCreateRequestSchema = z.object({
  sectionIds: z.array(z.number().int().positive()).optional(),
});

export const localeUpdateRequestSchema = z.object({
  locale: z.enum(APP_LOCALES),
});

export const dashboardLinkVisitRequestSchema = z.object({
  slug: z.string().trim().min(1),
});

export const dashboardLinkPinRequestSchema = z.object({
  slug: z.string().trim().min(1),
  returnTo: z.string().trim().optional(),
  action: z.enum(["pin", "unpin"]).optional(),
});

export const todoCreateRequestSchema = z.object({
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH),
  content: z.string().max(TODO_CONTENT_MAX_LENGTH).optional().nullable(),
  priority: todoPrioritySchema.optional(),
  dueAt: z.union([z.string(), z.null()]).optional(),
});

export const todoUpdateRequestSchema = z.object({
  title: z.string().trim().min(1).max(TODO_TITLE_MAX_LENGTH).optional(),
  content: z.string().max(TODO_CONTENT_MAX_LENGTH).optional().nullable(),
  priority: todoPrioritySchema.optional(),
  dueAt: z.union([z.string(), z.null()]).optional(),
  completed: z.boolean().optional(),
});
