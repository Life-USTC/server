import * as z from "zod";
import { APP_LOCALES } from "@/i18n/config";
import {
  dateInputStringSchema,
  integerStringSchema,
  todoPrioritySchema,
} from "./request-schema-primitives";

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
  limit: integerStringSchema.optional(),
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
  limit: integerStringSchema.optional(),
});

export const subscribedSchedulesQuerySchema = z.object({
  dateFrom: dateInputStringSchema.optional(),
  dateTo: dateInputStringSchema.optional(),
  weekday: integerStringSchema.optional(),
  limit: integerStringSchema.optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const compactOverviewQuerySchema = z.object({
  atTime: z.string().trim().min(1).optional(),
  homeworkWindowDays: integerStringSchema.optional(),
  limit: integerStringSchema.optional(),
  locale: z.enum(APP_LOCALES).optional(),
});

export const todosQuerySchema = z.object({
  completed: z.enum(["true", "false"]).optional(),
  priority: todoPrioritySchema.optional(),
  dueBefore: dateInputStringSchema.optional(),
  dueAfter: dateInputStringSchema.optional(),
  limit: integerStringSchema.optional(),
});

export const uploadObjectQuerySchema = z.object({
  key: z.string().trim().min(1),
});
