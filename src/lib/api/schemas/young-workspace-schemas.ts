import { z } from "zod";
import {
  booleanQuerySchema,
  dateInputStringSchema,
  integerStringRangeSchema,
} from "./request-schema-primitives";
import {
  createPaginatedSchema,
  dateTimeSchema,
} from "./response-schema-primitives";
import { youngEventSummarySchema } from "./young-event-schemas";

export const youngWorkspaceQuerySchema = z.object({
  page: integerStringRangeSchema({
    minimum: 1,
    maximum: 100000,
    message: "Invalid page",
  }).optional(),
  pageSize: integerStringRangeSchema({
    minimum: 1,
    maximum: 100,
    message: "Invalid pageSize",
  }).optional(),
  unread: booleanQuerySchema.optional(),
});
export const youngEventSubscriptionRequestSchema = z.strictObject({
  subscribed: z.boolean(),
  remindSignup: z.boolean().optional(),
  remindDeadline: z.boolean().optional(),
  remindStart: z.boolean().optional(),
});
export const youngOrganizerSubscriptionRequestSchema = z.strictObject({
  subscribed: z.boolean(),
});
export const youngEventSubscriptionStateSchema = z.strictObject({
  youngId: z.string(),
  subscribed: z.boolean(),
  remindSignup: z.boolean(),
  remindDeadline: z.boolean(),
  remindStart: z.boolean(),
});
export const youngOrganizerSubscriptionStateSchema = z.strictObject({
  organizerId: z.string(),
  subscribed: z.boolean(),
});
export const youngEventSubscriptionListSchema = createPaginatedSchema(
  z.strictObject({
    youngId: z.string(),
    createdAt: dateTimeSchema,
    remindSignup: z.boolean(),
    remindDeadline: z.boolean(),
    remindStart: z.boolean(),
    event: youngEventSummarySchema,
  }),
);
export const youngOrganizerSubscriptionListSchema = createPaginatedSchema(
  z.strictObject({
    organizerId: z.string(),
    createdAt: dateTimeSchema,
    organizer: z.strictObject({ id: z.string(), name: z.string() }),
  }),
);
export const youngNotificationSchema = z.strictObject({
  id: z.string(),
  youngId: z.string().nullable(),
  organizerId: z.string().nullable(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: dateTimeSchema,
  readAt: dateTimeSchema.nullable(),
  expiresAt: dateTimeSchema.nullable(),
});
export const youngNotificationListSchema = createPaginatedSchema(
  youngNotificationSchema,
);
export const youngNotificationReadSchema = z.strictObject({
  id: z.string(),
  success: z.boolean(),
});

export const personalCalendarQuerySchema = youngWorkspaceQuerySchema
  .omit({ unread: true })
  .extend({
    dateFrom: dateInputStringSchema.optional(),
    dateTo: dateInputStringSchema.optional(),
  });
export const personalCalendarItemSchema = z.strictObject({
  id: z.string(),
  type: z.enum(["schedule", "exam", "homework_due", "todo_due", "young_event"]),
  at: dateTimeSchema.nullable(),
  endsAt: dateTimeSchema.nullable(),
  title: z.string(),
  location: z.string().nullable(),
  url: z.string(),
  youngId: z.string().nullable(),
});
export const personalCalendarPageSchema = createPaginatedSchema(
  personalCalendarItemSchema,
);
