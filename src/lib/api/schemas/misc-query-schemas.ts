import * as z from "zod";
import { APP_LOCALES } from "@/i18n/config";
import {
  booleanQuerySchema,
  dateQuerySchema,
  deprecatedPaginationLimitParam,
  integerQueryRangeSchema,
  integerStringRangeSchema,
  integerStringSchema,
  paginationPageSizeParam,
  todoPrioritySchema,
} from "./request-schema-primitives";

const positiveCampusIdQuerySchema = integerQueryRangeSchema({
  minimum: 1,
  message: "campus ID must be a positive integer",
});

const busNextDeparturesLimitSchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 50,
  message: "limit must be between 1 and 50",
});

const publicPaginationPageSizeSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 100,
  message: "pageSize must be between 1 and 100",
});

const subscribedSchedulesWeekdaySchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 7,
  message: "weekday must be between 1 and 7",
});

const subscribedSchedulesLimitSchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 300,
  message: "limit must be between 1 and 300",
});

const todoLimitSchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 200,
  message: "limit must be between 1 and 200",
});

const overviewHomeworkWindowDaysSchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 90,
  message: "homeworkWindowDays must be between 1 and 90",
});

const compactOverviewLimitSchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 50,
  message: "limit must be between 1 and 50",
});

export const busQuerySchema = z.object({
  versionKey: z.string().trim().min(1).optional(),
});

export const busRouteSearchQuerySchema = z.object({
  originCampusId: positiveCampusIdQuerySchema.optional(),
  destinationCampusId: positiveCampusIdQuerySchema.optional(),
  versionKey: z.string().trim().min(1).optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const busNextDeparturesQuerySchema = z.object({
  originCampusId: positiveCampusIdQuerySchema,
  destinationCampusId: positiveCampusIdQuerySchema,
  atTime: dateQuerySchema().optional(),
  dayType: z.enum(["auto", "weekday", "weekend"]).optional(),
  includeDeparted: booleanQuerySchema.optional(),
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
  pageSize: paginationPageSizeParam(publicPaginationPageSizeSchema),
  limit: deprecatedPaginationLimitParam(publicPaginationPageSizeSchema),
});

export const subscribedSchedulesQuerySchema = z.object({
  dateFrom: dateQuerySchema().optional(),
  dateTo: dateQuerySchema().optional(),
  weekday: subscribedSchedulesWeekdaySchema.optional(),
  limit: subscribedSchedulesLimitSchema.optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const compactOverviewQuerySchema = z.object({
  atTime: dateQuerySchema({ dateOnlyAsShanghaiStart: true }).optional(),
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
  completed: booleanQuerySchema.optional(),
  priority: todoPrioritySchema.optional(),
  dueBefore: dateQuerySchema().optional(),
  dueAfter: dateQuerySchema().optional(),
  limit: todoLimitSchema.optional(),
});

export const uploadObjectQuerySchema = z.object({
  key: z.string().trim().min(1),
});
