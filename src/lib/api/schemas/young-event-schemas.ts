import * as z from "zod";
import {
  booleanQuerySchema,
  deprecatedPaginationLimitParam,
  integerStringRangeSchema,
  paginationPageSizeParam,
} from "./request-schema-primitives";
import {
  createPaginatedSchema,
  dateTimeSchema,
} from "./response-schema-primitives";

const youngEventPageSizeSchema = integerStringRangeSchema({
  minimum: 1,
  maximum: 100,
  message: "pageSize must be between 1 and 100",
});

export const youngEventsQuerySchema = z.object({
  active: booleanQuerySchema
    .optional()
    .describe("Filter by signup-open (active) events."),
  category: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Exact category filter, e.g. 单次项目 or 系列项目."),
  search: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Case-insensitive substring match on the event name."),
  page: integerStringRangeSchema({
    minimum: 1,
    maximum: 1000,
    message: "page must be between 1 and 1000",
  }).optional(),
  pageSize: paginationPageSizeParam(youngEventPageSizeSchema),
  limit: deprecatedPaginationLimitParam(youngEventPageSizeSchema),
});

export type YoungEventsQuery = z.output<typeof youngEventsQuerySchema>;

export const youngEventSummarySchema = z.strictObject({
  youngId: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  department: z.string().nullable(),
  organizer: z.string().nullable(),
  status: z.string().nullable(),
  registrationStatus: z.string().nullable(),
  location: z.string().nullable(),
  imageUrl: z.string().nullable(),
  hours: z.number().nullable(),
  capacity: z.number().int().nullable(),
  appliedCount: z.number().int().nullable(),
  startAt: dateTimeSchema.nullable(),
  endAt: dateTimeSchema.nullable(),
  applyStartAt: dateTimeSchema.nullable(),
  applyEndAt: dateTimeSchema.nullable(),
  isActive: z.boolean(),
});

export const youngEventDetailSchema = youngEventSummarySchema.extend({
  rawJson: z.unknown(),
});

export const paginatedYoungEventResponseSchema = createPaginatedSchema(
  youngEventSummarySchema,
);
