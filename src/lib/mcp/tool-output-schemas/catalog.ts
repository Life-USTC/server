import { z } from "zod";
import { weatherSnapshotResponseSchema } from "@/lib/api/schemas/weather-response-schemas";
import {
  paginatedYoungEventResponseSchema,
  youngEventDetailSchema,
  youngEventSummarySchema,
} from "@/lib/api/schemas/young-event-schemas";
import {
  compactCatalogExamSchema,
  compactCatalogTeacherSchema,
  compactCourseSchema,
  compactMatchSectionSchema,
  compactPublicScheduleSchema,
  compactScopedScheduleSchema,
  compactSectionContextSchema,
  compactSectionDetailSchema,
  compactSectionSummarySchema,
  compactSemesterSchema,
  compactSubscriptionSectionSchema,
  compactTeacherDetailSchema,
  courseDetailMcpSchema,
  courseDetailSchema,
  courseSchema,
  exactFailureOutputSchema,
  exactSuccessOutput,
  fullCatalogExamSchema,
  type McpToolOutputSchema,
  matchSectionCodesResponseSchema,
  objectOutputSchema,
  paginatedCourseDefaultMcpSchema,
  paginatedCourseFullMcpSchema,
  paginatedCourseResponseSchema,
  paginatedScheduleDefaultMcpSchema,
  paginatedScheduleFullMcpSchema,
  paginatedScheduleResponseSchema,
  paginatedSectionDefaultMcpSchema,
  paginatedSectionFullMcpSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterMcpSchema,
  paginatedTeacherDefaultMcpSchema,
  paginatedTeacherFullMcpSchema,
  paginatedTeacherResponseSchema,
  scheduleEntryMcpSchema,
  sectionCalendarFeedOutputSchema,
  sectionCompactMcpSchema,
  sectionContextFullSchema,
  sectionDetailMcpSchema,
  sectionGetDefaultSchema,
  sectionGetFullSchema,
  sectionScheduleWithContextSchema,
  sectionSummarySchema,
  subscriptionFullSectionSchema,
  teacherDetailMcpSchema,
  teacherDetailSchema,
  teacherListSchema,
  topLevelOutputSchema,
} from "./shared";

export const weatherNoDataSchema = z.strictObject({
  success: z.literal(true),
  locationKey: z.enum(["ustc-main", "ustc-gaoxin"]),
  hasData: z.literal(false),
  message: z.string(),
});

export const weatherDefaultSchema = z.union([
  z.strictObject({
    ...weatherSnapshotResponseSchema.omit({ extensions: true }).shape,
    success: z.literal(true),
  }),
  weatherNoDataSchema,
]);

export const weatherFullSchema = z.union([
  z.strictObject({
    ...weatherSnapshotResponseSchema.shape,
    success: z.literal(true),
  }),
  weatherNoDataSchema,
]);

export const compactYoungEventSchema = youngEventSummarySchema.omit({
  department: true,
  organizer: true,
  imageUrl: true,
});

export const youngEventPaginationSchema =
  paginatedYoungEventResponseSchema.shape.pagination;

export const youngEventListDefaultSchema = objectOutputSchema({
  data: z.array(compactYoungEventSchema),
  pagination: youngEventPaginationSchema,
});

export const youngEventListFullSchema = objectOutputSchema({
  data: z.array(youngEventSummarySchema),
  pagination: youngEventPaginationSchema,
});

export const youngEventGetDefaultSchema = objectOutputSchema({
  youngId: z.string(),
  event: youngEventSummarySchema.nullable(),
});

export const youngEventGetFullSchema = objectOutputSchema({
  youngId: z.string(),
  event: youngEventDetailSchema.nullable(),
});

export const catalogAcademicModeOutputSchemas = {
  catalog_course_search: {
    default: paginatedCourseDefaultMcpSchema,
    full: paginatedCourseFullMcpSchema,
  },
  catalog_course_get: {
    default: exactSuccessOutput({
      found: z.boolean(),
      course: compactCourseSchema.nullable(),
    }),
    full: exactSuccessOutput({
      found: z.boolean(),
      course: courseDetailSchema.nullable(),
    }),
  },
  catalog_section_search: {
    default: paginatedSectionDefaultMcpSchema,
    full: paginatedSectionFullMcpSchema,
  },
  catalog_section_get: {
    default: sectionGetDefaultSchema,
    full: sectionGetFullSchema,
  },
  catalog_section_match_preview: {
    default: z.union([
      exactSuccessOutput({
        ...matchSectionCodesResponseSchema.omit({ sections: true }).shape,
        sections: z.array(compactMatchSectionSchema),
        note: z.string(),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({
        ...matchSectionCodesResponseSchema.shape,
        note: z.string(),
      }),
      exactFailureOutputSchema,
    ]),
  },
  catalog_teacher_search: {
    default: paginatedTeacherDefaultMcpSchema,
    full: paginatedTeacherFullMcpSchema,
  },
  catalog_teacher_get: {
    default: exactSuccessOutput({
      found: z.boolean(),
      teacher: compactTeacherDetailSchema.nullable(),
    }),
    full: exactSuccessOutput({
      found: z.boolean(),
      teacher: teacherDetailSchema.nullable(),
    }),
  },
  catalog_schedule_list: {
    default: z.union([
      paginatedScheduleDefaultMcpSchema,
      exactFailureOutputSchema,
    ]),
    full: z.union([paginatedScheduleFullMcpSchema, exactFailureOutputSchema]),
  },
  catalog_section_schedule_list: {
    default: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: compactSectionContextSchema,
        schedules: z.array(compactScopedScheduleSchema),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: sectionContextFullSchema,
        schedules: z.array(sectionScheduleWithContextSchema),
      }),
      exactFailureOutputSchema,
    ]),
  },
  catalog_section_exam_list: {
    default: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: compactSectionContextSchema,
        exams: z.array(compactCatalogExamSchema),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({
        found: z.literal(true),
        section: sectionContextFullSchema,
        exams: z.array(fullCatalogExamSchema),
      }),
      exactFailureOutputSchema,
    ]),
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

export type CatalogAcademicModeToolName =
  keyof typeof catalogAcademicModeOutputSchemas;

export const catalogAdvertisedOutputSchemas: Record<
  CatalogAcademicModeToolName,
  McpToolOutputSchema
> = {
  catalog_course_search: objectOutputSchema({
    data: z.array(z.union([compactCourseSchema, courseSchema])),
    pagination: paginatedCourseResponseSchema.shape.pagination,
  }),
  catalog_course_get: objectOutputSchema({
    course: z.union([compactCourseSchema, courseDetailMcpSchema]).nullable(),
  }),
  catalog_section_search: objectOutputSchema({
    data: z.array(z.union([compactSectionSummarySchema, sectionSummarySchema])),
    pagination: paginatedSectionResponseSchema.shape.pagination,
  }),
  catalog_section_get: objectOutputSchema({
    section: z.union([compactSectionDetailSchema, sectionDetailMcpSchema]),
  }),
  catalog_section_match_preview: objectOutputSchema({
    ...matchSectionCodesResponseSchema.omit({ sections: true }).shape,
    sections: z.array(
      z.union([compactMatchSectionSchema, sectionCompactMcpSchema]),
    ),
    note: z.string(),
  }),
  catalog_teacher_search: objectOutputSchema({
    data: z.array(z.union([compactCatalogTeacherSchema, teacherListSchema])),
    pagination: paginatedTeacherResponseSchema.shape.pagination,
  }),
  catalog_teacher_get: objectOutputSchema({
    teacher: z
      .union([compactTeacherDetailSchema, teacherDetailMcpSchema])
      .nullable(),
  }),
  catalog_schedule_list: objectOutputSchema({
    data: z.array(
      z.union([compactPublicScheduleSchema, scheduleEntryMcpSchema]),
    ),
    pagination: paginatedScheduleResponseSchema.shape.pagination,
  }),
  catalog_section_schedule_list: objectOutputSchema({
    section: z.union([compactSectionContextSchema, sectionContextFullSchema]),
    schedules: z.array(
      z.union([compactScopedScheduleSchema, sectionScheduleWithContextSchema]),
    ),
  }),
  catalog_section_exam_list: objectOutputSchema({
    section: z.union([compactSectionContextSchema, sectionContextFullSchema]),
    exams: z.array(z.union([compactCatalogExamSchema, fullCatalogExamSchema])),
  }),
};

export const catalogNonAcademicModeOutputSchemas = {
  catalog_section_calendar_feed_get: {
    default: sectionCalendarFeedOutputSchema(compactSubscriptionSectionSchema),
    full: sectionCalendarFeedOutputSchema(subscriptionFullSectionSchema),
  },
  catalog_weather_get: {
    default: weatherDefaultSchema,
    full: weatherFullSchema,
  },
  catalog_young_event_list: {
    default: youngEventListDefaultSchema,
    full: youngEventListFullSchema,
  },
  catalog_young_event_get: {
    default: youngEventGetDefaultSchema,
    full: youngEventGetFullSchema,
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

function advertisedCatalogOutputSchema(name: CatalogAcademicModeToolName) {
  return catalogAdvertisedOutputSchemas[name];
}

export const catalogToolOutputSchemas: Record<string, McpToolOutputSchema> = {
  catalog_section_calendar_feed_get: objectOutputSchema({
    section: z
      .union([compactSubscriptionSectionSchema, subscriptionFullSectionSchema])
      .nullable(),
    calendarPath: z.string(),
    calendarUrl: z.string(),
  }),
  catalog_link_list: topLevelOutputSchema([
    "query",
    "total",
    "returned",
    "links",
  ]),
  catalog_weather_get: objectOutputSchema({
    ...weatherSnapshotResponseSchema.shape,
    locationKey: z.enum(["ustc-main", "ustc-gaoxin"]),
    hasData: z.boolean(),
  }),
  catalog_young_event_list: objectOutputSchema({
    data: z.array(z.union([compactYoungEventSchema, youngEventSummarySchema])),
    pagination: youngEventPaginationSchema,
  }),
  catalog_young_event_get: objectOutputSchema({
    youngId: z.string(),
    event: z
      .union([youngEventSummarySchema, youngEventDetailSchema])
      .nullable(),
  }),
  catalog_course_search: advertisedCatalogOutputSchema("catalog_course_search"),
  catalog_course_get: advertisedCatalogOutputSchema("catalog_course_get"),
  catalog_semester_list: paginatedSemesterMcpSchema,
  catalog_semester_current: objectOutputSchema({
    semester: compactSemesterSchema.nullable(),
  }),
  catalog_section_get: advertisedCatalogOutputSchema("catalog_section_get"),
  catalog_section_search: advertisedCatalogOutputSchema(
    "catalog_section_search",
  ),
  catalog_section_match_preview: advertisedCatalogOutputSchema(
    "catalog_section_match_preview",
  ),
  catalog_teacher_search: advertisedCatalogOutputSchema(
    "catalog_teacher_search",
  ),
  catalog_teacher_get: advertisedCatalogOutputSchema("catalog_teacher_get"),
  catalog_schedule_list: advertisedCatalogOutputSchema("catalog_schedule_list"),
  catalog_section_schedule_list: advertisedCatalogOutputSchema(
    "catalog_section_schedule_list",
  ),
  catalog_section_exam_list: advertisedCatalogOutputSchema(
    "catalog_section_exam_list",
  ),
};
