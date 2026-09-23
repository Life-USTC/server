import * as z from "zod";
import {
  booleanQuerySchema,
  dateInputStringSchema,
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

export const youngEventTimeBasisSchema = z.enum(["activity", "registration"]);

export const youngEventsQuerySchema = z.object({
  dateUnknown: booleanQuerySchema
    .optional()
    .describe(
      "Filter activities missing the selected time basis start; incompatible with date bounds.",
    ),
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
  module: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Exact second-classroom module filter, e.g. 德/智/体/美/劳."),
  activityLevel: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Exact activity-level filter, e.g. 院级 or 校级."),
  search: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Case-insensitive substring match on the event name."),
  organizerId: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Stable local Young organizer ID."),
  dateFrom: dateInputStringSchema
    .optional()
    .describe("Inclusive Shanghai date/time range start."),
  dateTo: dateInputStringSchema
    .optional()
    .describe("Inclusive Shanghai date/time range end."),
  timeBasis: youngEventTimeBasisSchema
    .optional()
    .describe("Date fields to use for range overlap filtering."),
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
  organizerId: z.string().nullable(),
  status: z.string().nullable(),
  registrationStatus: z
    .string()
    .nullable()
    .describe(
      "Deprecated: always null. Upstream never populates it; use status for the signup state.",
    ),
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
  sourceMissing: z.boolean(),
  lastSeenAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema.nullable(),
  activityLevel: z.string().nullable(),
  module: z.string().nullable(),
  form: z.string().nullable(),
  grades: z.string().nullable(),
  sponsor: z.string().nullable(),
  contactName: z.string().nullable(),
  contactTel: z.string().nullable(),
  duration: z.number().nullable(),
  serviceHour: z.number().nullable(),
  sumHours: z.number().nullable(),
  sumPersons: z.number().int().nullable(),
  partakeNum: z.number().int().nullable(),
  favCount: z.number().int().nullable(),
  limitNum: z.number().int().nullable(),
  createdAtUpstream: dateTimeSchema.nullable(),
  auditedAt: dateTimeSchema.nullable(),
  updatedAtUpstream: dateTimeSchema.nullable(),
  places: z
    .array(
      z.strictObject({
        placeInfo: z.string().nullable(),
        placeSt: z.string().nullable(),
        placeEt: z.string().nullable(),
      }),
    )
    .nullable(),
});

// Long rich-text bodies stay out of list payloads: a single description can
// reach tens of kilobytes.
export const youngEventDetailSchema = youngEventSummarySchema.extend({
  description: z.string().nullable(),
  participationNotes: z.string().nullable(),
  rawJson: z.unknown(),
});

export const paginatedYoungEventResponseSchema = createPaginatedSchema(
  youngEventSummarySchema,
).extend({
  unknownDateCount: z.number().int().nonnegative(),
  source: z.strictObject({
    status: z.enum(["fresh", "stale", "unknown"]),
    lastSyncedAt: dateTimeSchema.nullable(),
  }),
});

export const youngOrganizerSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  totalCount: z.number().int().nonnegative(),
  activeCount: z.number().int().nonnegative(),
  upcomingCount: z.number().int().nonnegative(),
  historyCount: z.number().int().nonnegative(),
});

export const youngOrganizersQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  page: integerStringRangeSchema({
    minimum: 1,
    maximum: 1000,
    message: "page must be between 1 and 1000",
  }).optional(),
  pageSize: paginationPageSizeParam(youngEventPageSizeSchema),
  limit: deprecatedPaginationLimitParam(youngEventPageSizeSchema),
});

export const paginatedYoungOrganizerResponseSchema = createPaginatedSchema(
  youngOrganizerSummarySchema,
);
