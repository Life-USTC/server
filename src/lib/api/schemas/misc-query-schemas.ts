import * as z from "zod";
import {
  integerStringSchema,
  todoPrioritySchema,
} from "./request-schema-primitives";

export const busQuerySchema = z.object({
  versionKey: z.string().trim().min(1).optional(),
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

export const todosQuerySchema = z.object({
  completed: z.enum(["true", "false"]).optional(),
  priority: todoPrioritySchema.optional(),
  dueBefore: z.string().trim().datetime().optional(),
  dueAfter: z.string().trim().datetime().optional(),
});
