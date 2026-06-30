import * as z from "zod";
import {
  todoCreateInputSchema,
  todoUpdateInputSchema,
} from "@/features/todos/lib/todo-schema";
import { APP_LOCALES } from "@/i18n/config";

const subscriptionSectionIdSchema = z
  .number()
  .int()
  .positive()
  .meta({
    override: ({ jsonSchema }: { jsonSchema: Record<string, unknown> }) => {
      jsonSchema.type = "integer";
      jsonSchema.minimum = 1;
      delete jsonSchema.exclusiveMinimum;
    },
  });

export const calendarSubscriptionCreateRequestSchema = z.object({
  sectionIds: z.array(subscriptionSectionIdSchema).optional(),
});

export const calendarSubscriptionAppendRequestSchema = z.object({
  sectionIds: z.array(subscriptionSectionIdSchema),
});

export const calendarSubscriptionRemoveRequestSchema =
  calendarSubscriptionAppendRequestSchema;

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

export const todoCompletionBatchRequestSchema = z.object({
  items: z.array(
    z.object({
      todoId: z.string().trim().min(1),
      completed: z.boolean(),
    }),
  ).min(1).max(100),
});
