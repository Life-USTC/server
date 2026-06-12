import * as z from "zod";
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
  title: z.string().trim().min(1).max(200),
  content: z.string().max(4000).optional().nullable(),
  priority: todoPrioritySchema.optional(),
  dueAt: z.union([z.string(), z.null()]).optional(),
});

export const todoUpdateRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(4000).optional().nullable(),
  priority: todoPrioritySchema.optional(),
  dueAt: z.union([z.string(), z.null()]).optional(),
  completed: z.boolean().optional(),
});
