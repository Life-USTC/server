import * as z from "zod";
import { busVersionKeySchema } from "@/features/bus/lib/bus-version-key";
import { CATALOG_MAX_PAGE } from "@/features/catalog/lib/catalog-list-query";
import {
  TODO_LIST_DEFAULT_LIMIT,
  TODO_LIST_MAX_LIMIT,
} from "@/features/todos/lib/todo-list-limits";
import { APP_LOCALES } from "@/i18n/config";
import {
  booleanQuerySchema,
  dateQuerySchema,
  deprecatedPaginationLimitParam,
  integerQueryRangeSchema,
  integerStringRangeSchema,
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

const publicCatalogPageSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: CATALOG_MAX_PAGE,
  message: `page must be between 1 and ${CATALOG_MAX_PAGE}`,
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
  maximum: TODO_LIST_MAX_LIMIT,
  message: `limit must be between 1 and ${TODO_LIST_MAX_LIMIT}`,
}).meta({
  override: {
    type: "integer",
    format: "int64",
    minimum: 1,
    maximum: TODO_LIST_MAX_LIMIT,
    default: TODO_LIST_DEFAULT_LIMIT,
  },
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

const accountClientActivityLimitSchema = integerQueryRangeSchema({
  minimum: 1,
  maximum: 50,
  message: "limit must be between 1 and 50",
});

export const accountClientActivityQuerySchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: accountClientActivityLimitSchema.optional(),
});

export const busQuerySchema = z.object({
  versionKey: busVersionKeySchema.optional(),
});

export const busRouteSearchQuerySchema = z.object({
  originCampusId: positiveCampusIdQuerySchema.optional(),
  destinationCampusId: positiveCampusIdQuerySchema.optional(),
  versionKey: busVersionKeySchema.optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const busNextDeparturesQuerySchema = z.object({
  originCampusId: positiveCampusIdQuerySchema,
  destinationCampusId: positiveCampusIdQuerySchema,
  atTime: dateQuerySchema().optional(),
  dayType: z.enum(["auto", "weekday", "saturday", "sunday"]).optional(),
  includeDeparted: booleanQuerySchema.optional(),
  limit: busNextDeparturesLimitSchema.optional(),
  versionKey: busVersionKeySchema.optional(),
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
  page: publicCatalogPageSchema.optional(),
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
  limit: todoLimitSchema.default(TODO_LIST_DEFAULT_LIMIT),
});

export const uploadObjectQuerySchema = z.object({
  key: z.string().trim().min(1),
});
