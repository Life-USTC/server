import * as z from "zod";
import {
  todoCreateInputSchema,
  todoUpdateInputSchema,
} from "@/features/todos/lib/todo-schema";
import { APP_LOCALES } from "@/i18n/config";

export const calendarSubscriptionCreateRequestSchema = z.object({
  sectionIds: z.array(z.number().int().positive()).optional(),
});

export const calendarSubscriptionAppendRequestSchema = z.object({
  sectionIds: z.array(z.number().int().positive()),
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

export const todoCreateRequestSchema = todoCreateInputSchema;

export const todoUpdateRequestSchema = todoUpdateInputSchema;
