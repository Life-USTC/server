import * as z from "zod";
import { APP_LOCALES } from "@/i18n/config";
import {
  dateInputStringSchema,
  integerStringRangeSchema,
  integerStringSchema,
  todoPrioritySchema,
} from "./request-schema-primitives";

const busNextDeparturesLimitSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 50,
  message: "limit must be between 1 and 50",
});

const publicPaginationLimitSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 100,
  message: "limit must be between 1 and 100",
});

const subscribedSchedulesWeekdaySchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 7,
  message: "weekday must be between 1 and 7",
});

const subscribedSchedulesLimitSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 300,
  message: "limit must be between 1 and 300",
});

const todoLimitSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 200,
  message: "limit must be between 1 and 200",
});

const overviewHomeworkWindowDaysSchema = integerStringSchema
  .refine(
    (value) => {
      const days = Number.parseInt(value, 10);
      return days >= 1 && days <= 90;
    },
    { message: "homeworkWindowDays must be between 1 and 90" },
  )
  .meta({
    override: { type: "integer", format: "int64", minimum: 1, maximum: 90 },
  });

const compactOverviewLimitSchema = integerStringSchema
  .refine(
    (value) => {
      const limit = Number.parseInt(value, 10);
      return limit >= 1 && limit <= 50;
    },
    { message: "limit must be between 1 and 50" },
  )
  .meta({
    override: { type: "integer", format: "int64", minimum: 1, maximum: 50 },
  });

export const busQuerySchema = z.object({
  versionKey: z.string().trim().min(1).optional(),
});

export const busRouteSearchQuerySchema = z.object({
  originCampusId: integerStringSchema.optional(),
  destinationCampusId: integerStringSchema.optional(),
  versionKey: z.string().trim().min(1).optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const busNextDeparturesQuerySchema = z.object({
  originCampusId: integerStringSchema,
  destinationCampusId: integerStringSchema,
  atTime: z.string().trim().min(1).optional(),
  dayType: z.enum(["auto", "weekday", "weekend"]).optional(),
  includeDeparted: z.enum(["true", "false"]).optional(),
  limit: busNextDeparturesLimitSchema.optional(),
  versionKey: z.string().trim().min(1).optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const busPreferenceRequestSchema = z.object({
  preferredOriginCampusId: z.number().int().positive().nullable().default(null),
  preferredDestinationCampusId: z
    .number()
    .int()
    .positive()
    .nullable()
    .default(null),
  showDepartedTrips: z.boolean(),
});

export const dashboardLinkVisitQuerySchema = z.object({
  slug: z.string().trim().min(1),
});

export const semestersQuerySchema = z.object({
  page: integerStringSchema.optional(),
  limit: publicPaginationLimitSchema.optional(),
});

export const subscribedSchedulesQuerySchema = z.object({
  dateFrom: dateInputStringSchema.optional(),
  dateTo: dateInputStringSchema.optional(),
  weekday: subscribedSchedulesWeekdaySchema.optional(),
  limit: subscribedSchedulesLimitSchema.optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const compactOverviewQuerySchema = z.object({
  atTime: z.string().trim().min(1).optional(),
  homeworkWindowDays: overviewHomeworkWindowDaysSchema.optional(),
  limit: compactOverviewLimitSchema.optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const publicUserProfileQuerySchema = z
  .object({
    username: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.username && input.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either username or userId, not both",
        path: ["username"],
      });
      return;
    }

    if (!input.username && !input.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide username or userId",
        path: ["username"],
      });
    }
  });

export const todosQuerySchema = z.object({
  completed: z.enum(["true", "false"]).optional(),
  priority: todoPrioritySchema.optional(),
  dueBefore: dateInputStringSchema.optional(),
  dueAfter: dateInputStringSchema.optional(),
  limit: todoLimitSchema.optional(),
});

export const uploadObjectQuerySchema = z.object({
  key: z.string().trim().min(1),
});
