import * as z from "zod";
import {
  todoCreateInputSchema,
  todoUpdateInputSchema,
} from "@/features/todos/lib/todo-schema";
import { APP_LOCALES } from "@/i18n/config";
import { parseOptionalIntLike } from "./request-schema-primitives";

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

const subscriptionLookupCodeSchema = z.string().trim().min(1).max(64);
const subscriptionSectionIdsSchema = z
  .array(subscriptionSectionIdSchema)
  .max(500);

const calendarSubscriptionSelectionRequestSchema = z.object({
  sectionIds: subscriptionSectionIdsSchema.optional(),
  codes: z.array(subscriptionLookupCodeSchema).max(500).optional(),
  semesterId: z
    .preprocess(parseOptionalIntLike, z.union([z.string(), z.number()]))
    .optional(),
});

function hasCalendarSubscriptionSelection(
  input: z.infer<typeof calendarSubscriptionSelectionRequestSchema>,
) {
  return (input.sectionIds?.length ?? 0) > 0 || (input.codes?.length ?? 0) > 0;
}

export const calendarSubscriptionCreateRequestSchema = z.object({
  sectionIds: subscriptionSectionIdsSchema.optional(),
});

export const calendarSubscriptionAppendRequestSchema = z.object({
  sectionIds: subscriptionSectionIdsSchema,
});

export const calendarSubscriptionRemoveRequestSchema =
  calendarSubscriptionAppendRequestSchema;

export const calendarSubscriptionQueryRequestSchema =
  calendarSubscriptionSelectionRequestSchema.refine(
    hasCalendarSubscriptionSelection,
    "sectionIds or codes is required",
  );

export const calendarSubscriptionBatchActionSchema = z.enum([
  "add",
  "remove",
  "set",
]);

export const calendarSubscriptionBatchRequestSchema =
  calendarSubscriptionSelectionRequestSchema
    .extend({
      action: calendarSubscriptionBatchActionSchema,
    })
    .superRefine((input, context) => {
      if (input.action === "set") {
        if (input.semesterId === undefined) {
          context.addIssue({
            code: "custom",
            message: "semesterId is required when action is set",
            path: ["semesterId"],
          });
        }
        return;
      }

      if (hasCalendarSubscriptionSelection(input)) {
        return;
      }

      context.addIssue({
        code: "custom",
        message: "sectionIds or codes is required",
        path: ["sectionIds"],
      });
    });

export const localeUpdateRequestSchema = z.object({
  locale: z.enum(APP_LOCALES),
});

export const catalogLinkVisitRequestSchema = z.object({
  slug: z.string().trim().min(1),
});

export const workspaceLinkPinRequestSchema = z.object({
  slug: z.string().trim().min(1),
  returnTo: z.string().trim().optional(),
  action: z.enum(["pin", "unpin"]).optional(),
});

export const workspaceLinkPinBatchRequestSchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().trim().min(1),
        action: z.enum(["pin", "unpin"]),
      }),
    )
    .min(1)
    .max(10),
});

export const todoCreateRequestSchema = todoCreateInputSchema;

export const todoUpdateRequestSchema = todoUpdateInputSchema;

export const todoCompletionBatchRequestSchema = z.object({
  items: z
    .array(
      z.object({
        todoId: z.string().trim().min(1),
        completed: z.boolean(),
      }),
    )
    .min(1)
    .max(100),
});

export const todoBatchDeleteRequestSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
});
