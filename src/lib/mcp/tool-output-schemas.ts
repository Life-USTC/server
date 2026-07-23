import { z } from "zod";
import {
  paginatedCourseResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
} from "@/lib/api/schemas/academic-paginated-response-schemas";
import {
  commentAttachmentSummarySchema,
  commentAuthorSummarySchema,
  commentReactionSummarySchema,
} from "@/lib/api/schemas/comment-node-response-schema";
import { commentsListResponseSchema } from "@/lib/api/schemas/comments-response-schemas";
import {
  descriptionDetailSchema,
  descriptionHistoryEntrySchema,
} from "@/lib/api/schemas/descriptions-response-schemas";
import {
  matchSectionCodesResponseSchema,
  meResponseSchema,
  successResponseSchema,
  todoCountsSchema,
  todoItemSchema,
  viewerContextSchema,
} from "@/lib/api/schemas/misc-response-schema-core";
import { dateTimeSchema } from "@/lib/api/schemas/response-schema-primitives";
import { paginatedScheduleResponseSchema } from "@/lib/api/schemas/schedule-response-schema-core";
import {
  uploadDeleteResponseSchema,
  uploadRenameResponseSchema,
  uploadSummarySchema,
  uploadsListResponseSchema,
} from "@/lib/api/schemas/uploads-response-schemas";

type OutputShape = Record<string, z.ZodType>;

export type McpToolOutputSchema = z.ZodType;

const COMMON_OUTPUT_SHAPE = {
  success: z.boolean(),
  found: z.boolean().optional(),
  error: z.unknown().optional(),
  message: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  hint: z.string().optional(),
  result: z.unknown().optional(),
} satisfies OutputShape;

export const STRUCTURED_CONTENT_OUTPUT_SCHEMA = z
  .object(COMMON_OUTPUT_SHAPE)
  .strict()
  .describe("Object returned in structuredContent with an explicit status.");

function optionalizeShape(shape: OutputShape) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, schema.optional()]),
  ) as OutputShape;
}

function objectOutputSchema(shape: OutputShape) {
  return z
    .object({
      ...optionalizeShape(shape),
      ...COMMON_OUTPUT_SHAPE,
    })
    .strict()
    .describe("Canonical object returned in structuredContent.");
}

function objectOutputSchemaFromApi(schema: { shape: OutputShape }) {
  return objectOutputSchema(schema.shape);
}

function topLevelOutputSchema(keys: string[]) {
  return objectOutputSchema(
    Object.fromEntries(keys.map((key) => [key, z.unknown()])) as OutputShape,
  );
}

function collectionOutputSchema(itemSchema: z.ZodType) {
  return z.array(itemSchema);
}

function compactObjectSchema(shape: OutputShape) {
  return z.object(optionalizeShape(shape)).catchall(z.unknown());
}

const compactUserSchema = compactObjectSchema({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

const compactDepartmentSchema = compactObjectSchema({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
});

const compactTeacherTitleSchema = compactDepartmentSchema;

const compactCourseSchema = compactObjectSchema({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
  credit: z.number().nullable(),
  hours: z.number().nullable(),
});

const compactSemesterSchema = compactObjectSchema({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string().nullable(),
  nameCn: z.string(),
  namePrimary: z.string(),
  startDate: dateTimeSchema.nullable(),
  endDate: dateTimeSchema.nullable(),
});

const compactTeacherSchema = compactObjectSchema({
  id: z.number().int(),
  personId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  code: z.string().nullable(),
  jwId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
  department: compactDepartmentSchema.nullable(),
  teacherTitle: compactTeacherTitleSchema.nullable(),
  _count: z.object({ sections: z.number().int().nonnegative() }).partial(),
});

const compactCampusSchema = compactObjectSchema({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

const compactSectionSchema = compactObjectSchema({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema.nullable(),
  semester: compactSemesterSchema.nullable(),
  campus: compactCampusSchema.nullable(),
  openDepartment: compactDepartmentSchema.nullable(),
  teachers: z.array(compactTeacherSchema),
});

const compactTodoSchema = todoItemSchema
  .pick({
    id: true,
    title: true,
    priority: true,
    dueAt: true,
    completed: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    content: todoItemSchema.shape.content.optional(),
  })
  .partial()
  .catchall(z.unknown());

const compactHomeworkSchema = compactObjectSchema({
  id: z.string(),
  sectionId: z.number().int(),
  title: z.string(),
  isMajor: z.boolean().nullable(),
  requiresTeam: z.boolean().nullable(),
  publishedAt: dateTimeSchema.nullable(),
  submissionStartAt: dateTimeSchema.nullable(),
  submissionDueAt: dateTimeSchema.nullable(),
  deletedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  section: compactSectionSchema.nullable(),
  createdBy: compactUserSchema.nullable(),
  updatedBy: compactUserSchema.nullable(),
  deletedBy: compactUserSchema.nullable(),
  completion: z.unknown(),
  commentCount: z.number().int().nonnegative(),
});

const compactScheduleSchema = compactObjectSchema({
  id: z.number().int(),
  jwId: z.number().int(),
  date: dateTimeSchema.nullable(),
  weekday: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  weekIndex: z.number().int(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  customPlace: z.string().nullable(),
  section: compactSectionSchema.nullable(),
  teachers: z.array(compactTeacherSchema),
  room: z.unknown(),
});

const compactExamSchema = compactObjectSchema({
  id: z.number().int(),
  jwId: z.number().int(),
  examDate: dateTimeSchema.nullable(),
  startTime: z.number().int().nullable(),
  endTime: z.number().int().nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  examType: z.number().int().nullable(),
  examMode: z.string().nullable(),
  examTakeCount: z.number().int().nullable(),
  section: compactSectionSchema.nullable(),
  examBatch: z.unknown(),
  examRooms: z.array(z.unknown()),
});

const compactBusRouteSchema = compactObjectSchema({
  id: z.number().int(),
  routeId: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  descriptionPrimary: z.string().nullable(),
  descriptionSecondary: z.string().nullable(),
  weekdayTrips: z.number().int().nonnegative(),
  weekendTrips: z.number().int().nonnegative(),
  stopCount: z.number().int().nonnegative(),
  stops: z.array(z.unknown()),
  originCampus: compactCampusSchema.nullable(),
  destinationCampus: compactCampusSchema.nullable(),
});

const compactBusTripSchema = compactObjectSchema({
  id: z.number().int(),
  tripId: z.number().int(),
  routeId: z.number().int(),
  dayType: z.string(),
  position: z.number().int(),
  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  departureMinutes: z.number().int().nullable(),
  arrivalMinutes: z.number().int().nullable(),
  minutesUntilDeparture: z.number().int().nullable(),
  status: z.string().nullable(),
  stopTimes: z.unknown(),
  route: compactBusRouteSchema.nullable(),
  originCampus: compactCampusSchema.nullable(),
  destinationCampus: compactCampusSchema.nullable(),
});

const compactCalendarSubscriptionSchema = compactObjectSchema({
  userId: z.string(),
  sectionCount: z.number().int().nonnegative(),
  currentSemesterSectionCount: z.number().int().nonnegative(),
  currentSemesterSections: z.array(compactSectionSchema),
  sections: z.array(compactSectionSchema),
  calendarPath: z.string().nullable(),
  calendarUrl: z.string().nullable(),
  note: z.string(),
});

const paginatedCourseMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactCourseSchema),
  pagination: paginatedCourseResponseSchema.shape.pagination,
});

const paginatedSectionMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactSectionSchema),
  pagination: paginatedSectionResponseSchema.shape.pagination,
});

const paginatedTeacherMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactTeacherSchema),
  pagination: paginatedTeacherResponseSchema.shape.pagination,
});

const paginatedSemesterMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactSemesterSchema),
  pagination: paginatedSemesterResponseSchema.shape.pagination,
});

const paginatedScheduleMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(compactScheduleSchema),
  pagination: paginatedScheduleResponseSchema.shape.pagination,
});

const todoListMcpSchema = objectOutputSchema({
  counts: todoCountsSchema,
  todos: collectionOutputSchema(compactTodoSchema),
});

const uploadListMcpSchema = objectOutputSchema({
  data: collectionOutputSchema(uploadSummarySchema),
  pagination: uploadsListResponseSchema.shape.pagination,
  meta: uploadsListResponseSchema.shape.meta,
});

function createMcpCommentNodeSchema(includeRenderedBody: boolean): z.ZodType {
  let schema: z.ZodType;
  schema = z.lazy(() =>
    z
      .object({
        id: z.string(),
        body: z.string(),
        ...(includeRenderedBody ? { renderedBody: z.string() } : {}),
        visibility: z.string(),
        status: z.string(),
        author: commentAuthorSummarySchema.nullable(),
        authorHidden: z.boolean(),
        isAnonymous: z.boolean(),
        isAuthor: z.boolean(),
        createdAt: dateTimeSchema,
        updatedAt: dateTimeSchema,
        parentId: z.string().nullable(),
        rootId: z.string().nullable(),
        replies: z.array(schema),
        attachments: z.array(commentAttachmentSummarySchema),
        reactions: z.array(commentReactionSummarySchema),
        canReact: z.boolean(),
        canReply: z.boolean(),
        canEdit: z.boolean(),
        canDelete: z.boolean(),
        canModerate: z.boolean(),
      })
      .strict(),
  );
  return schema;
}

const compactCommentNodeSchema = createMcpCommentNodeSchema(false);
const fullCommentNodeSchema = createMcpCommentNodeSchema(true);
const commentNodeMcpSchema = z.union([
  compactCommentNodeSchema,
  fullCommentNodeSchema,
]);

const compactDescriptionDetailSchema = descriptionDetailSchema
  .omit({ renderedHtml: true })
  .strict();
const descriptionDetailMcpSchema = z.union([
  compactDescriptionDetailSchema,
  descriptionDetailSchema.strict(),
]);

function commentListOutputSchema(commentSchema: z.ZodType) {
  return objectOutputSchema({
    found: z.boolean(),
    data: collectionOutputSchema(commentSchema),
    pagination: commentsListResponseSchema.shape.pagination,
    meta: commentsListResponseSchema.shape.meta,
  });
}

function commentThreadOutputSchema(commentSchema: z.ZodType) {
  return objectOutputSchema({
    thread: collectionOutputSchema(commentSchema),
    focusId: z.string(),
    hiddenCount: z.number().int().nonnegative(),
    viewer: z.unknown(),
    target: z.unknown(),
  });
}

function descriptionOutputSchema(descriptionSchema: z.ZodType) {
  return objectOutputSchema({
    target: z.unknown(),
    description: descriptionSchema,
    history: collectionOutputSchema(descriptionHistoryEntrySchema),
    viewer: viewerContextSchema,
  });
}

function descriptionUpsertOutputSchema(descriptionSchema: z.ZodType) {
  return objectOutputSchema({
    id: z.string(),
    updated: z.boolean(),
    target: z.unknown(),
    description: descriptionSchema,
    history: collectionOutputSchema(descriptionHistoryEntrySchema),
    viewer: viewerContextSchema,
  });
}

const commentListMcpSchema = commentListOutputSchema(commentNodeMcpSchema);
const commentThreadMcpSchema = commentThreadOutputSchema(commentNodeMcpSchema);
const descriptionMcpSchema = descriptionOutputSchema(
  descriptionDetailMcpSchema,
);
const descriptionUpsertMcpSchema = descriptionUpsertOutputSchema(
  descriptionDetailMcpSchema,
);

const MARKDOWN_MODE_OUTPUT_SCHEMAS = {
  community_comment_list: {
    default: commentListOutputSchema(compactCommentNodeSchema),
    full: commentListOutputSchema(fullCommentNodeSchema),
  },
  community_comment_get: {
    default: commentThreadOutputSchema(compactCommentNodeSchema),
    full: commentThreadOutputSchema(fullCommentNodeSchema),
  },
  community_description_get: {
    default: descriptionOutputSchema(compactDescriptionDetailSchema),
    full: descriptionOutputSchema(descriptionDetailSchema.strict()),
  },
  community_description_set: {
    default: descriptionUpsertOutputSchema(compactDescriptionDetailSchema),
    full: descriptionUpsertOutputSchema(descriptionDetailSchema.strict()),
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

const matchSectionCodesMcpSchema = objectOutputSchema({
  ...matchSectionCodesResponseSchema.shape,
  success: z.boolean(),
  matchedCodes: collectionOutputSchema(z.string()),
  unmatchedCodes: collectionOutputSchema(z.string()),
  suggestions: z.record(z.string(), z.array(z.string())),
  sections: collectionOutputSchema(compactSectionSchema),
  note: z.string(),
});

// Production startup asserts that every registered application tool has an
// explicit entry. The fallback exists only for isolated SDK/test registrations.
const TOOL_OUTPUT_SCHEMAS: Record<string, McpToolOutputSchema> = {
  graphql_operation_run: objectOutputSchema({
    operationId: z.string(),
    operationName: z.string(),
    operationType: z.enum(["mutation", "query"]),
    data: z.record(z.string(), z.unknown()).nullable(),
    errors: z.array(
      z
        .object({
          message: z.string(),
          locations: z
            .array(
              z.object({
                line: z.number().int().positive(),
                column: z.number().int().positive(),
              }),
            )
            .optional(),
          path: z.array(z.union([z.string(), z.number().int()])).optional(),
          extensions: z.record(z.string(), z.unknown()).optional(),
        })
        .strict(),
    ),
    requiredScopes: z.array(z.string()),
  }),
  account_profile_get: objectOutputSchemaFromApi(meResponseSchema),
  community_user_get: objectOutputSchema({
    user: compactUserSchema,
    sectionCount: z.number().int().nonnegative(),
    weeks: z.unknown(),
    totalContributions: z.number().int().nonnegative(),
  }),
  workspace_todo_list: todoListMcpSchema,
  workspace_todo_create: objectOutputSchema({
    success: z.boolean(),
    id: z.string(),
  }),
  workspace_todo_update: objectOutputSchema({
    success: z.boolean(),
    todo: compactTodoSchema,
  }),
  workspace_todo_delete: objectOutputSchemaFromApi(successResponseSchema),

  workspace_homework_list: objectOutputSchema({
    homeworks: collectionOutputSchema(compactHomeworkSchema),
  }),
  workspace_homework_completion_set: topLevelOutputSchema(["completion"]),
  community_section_homework_list: objectOutputSchema({
    section: compactSectionSchema,
    homeworks: collectionOutputSchema(compactHomeworkSchema),
  }),
  community_section_homework_create: objectOutputSchema({
    id: z.string(),
    homework: compactHomeworkSchema,
    reason: z.string().nullable(),
  }),
  community_section_homework_update: objectOutputSchema({
    homework: compactHomeworkSchema,
    reason: z.string().nullable(),
  }),
  community_section_homework_delete: topLevelOutputSchema([
    "deletedId",
    "alreadyDeleted",
    "reason",
  ]),

  workspace_calendar_feed_get: objectOutputSchema({
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  workspace_subscription_list: objectOutputSchema({
    sections: collectionOutputSchema(compactSectionSchema),
    note: z.string(),
  }),
  workspace_subscription_add: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  workspace_subscription_remove: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  workspace_subscription_import: objectOutputSchema({
    semester: compactSemesterSchema,
    matchedCodes: collectionOutputSchema(z.string()),
    unmatchedCodes: collectionOutputSchema(z.string()),
    addedCount: z.number().int().nonnegative(),
    alreadySubscribedCount: z.number().int().nonnegative(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  catalog_section_calendar_feed_get: objectOutputSchema({
    section: compactSectionSchema.nullable(),
    calendarPath: z.string(),
    calendarUrl: z.string(),
  }),

  workspace_calendar_event_list: topLevelOutputSchema(["events"]),
  workspace_calendar_timeline_get: topLevelOutputSchema([
    "range",
    "total",
    "events",
  ]),

  community_comment_list: commentListMcpSchema,
  community_comment_get: commentThreadMcpSchema,
  community_comment_create: objectOutputSchema({
    success: z.boolean(),
    id: z.string(),
  }),
  community_comment_update: topLevelOutputSchema(["comment"]),
  community_comment_delete: objectOutputSchemaFromApi(successResponseSchema),
  community_comment_reaction_add: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),
  community_comment_reaction_remove: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),

  community_description_get: descriptionMcpSchema,
  community_description_set: descriptionUpsertMcpSchema,

  workspace_upload_list: uploadListMcpSchema,
  workspace_upload_rename: objectOutputSchema({
    ...uploadRenameResponseSchema.shape,
    success: z.boolean(),
    reason: z.string().nullable(),
  }),
  workspace_upload_delete: objectOutputSchema({
    ...uploadDeleteResponseSchema.shape,
    success: z.boolean(),
    reason: z.string().nullable(),
  }),

  workspace_snapshot_get: topLevelOutputSchema([
    "user",
    "currentSemester",
    "subscriptions",
    "nextClass",
    "upcomingDeadlines",
    "upcomingEvents",
    "todos",
    "bus",
  ]),
  catalog_link_list: topLevelOutputSchema([
    "query",
    "total",
    "returned",
    "links",
  ]),
  workspace_link_pin_list: topLevelOutputSchema([
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  workspace_link_pin_set: topLevelOutputSchema([
    "action",
    "slug",
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  workspace_deadline_list: topLevelOutputSchema(["total", "deadlines"]),
  workspace_overview_get: topLevelOutputSchema(["user", "overview", "samples"]),
  workspace_schedule_next: topLevelOutputSchema([
    "nextClass",
    "currentSemester",
  ]),

  catalog_bus_timetable_get: objectOutputSchema({
    locale: z.string(),
    fetchedAt: dateTimeSchema,
    version: z.unknown(),
    counts: z.unknown(),
    campuses: collectionOutputSchema(compactCampusSchema),
    routes: collectionOutputSchema(compactBusRouteSchema),
    trips: collectionOutputSchema(compactBusTripSchema),
    availableVersions: collectionOutputSchema(z.unknown()),
    preferences: z.unknown(),
    nextDepartures: collectionOutputSchema(compactBusTripSchema),
    nextDeparturesMessage: z.string().nullable(),
    notice: z.unknown(),
    hasData: z.boolean(),
  }),
  catalog_bus_route_list: objectOutputSchema({
    locale: z.string(),
    version: z.unknown(),
    campuses: collectionOutputSchema(compactCampusSchema),
    routes: collectionOutputSchema(compactBusRouteSchema),
    notice: z.unknown(),
  }),
  catalog_bus_route_get: objectOutputSchema({
    routeId: z.number().int(),
    route: compactBusRouteSchema,
    weekday: collectionOutputSchema(z.unknown()),
    weekend: collectionOutputSchema(z.unknown()),
    alternateRoutes: collectionOutputSchema(compactBusRouteSchema),
    hasData: z.boolean(),
  }),
  workspace_bus_preferences_get: topLevelOutputSchema(["preference"]),
  workspace_bus_preferences_set: topLevelOutputSchema(["preference"]),
  catalog_bus_route_search: objectOutputSchema({
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
    total: z.number().int().nonnegative(),
    routes: collectionOutputSchema(compactBusRouteSchema),
    hasData: z.boolean(),
  }),
  catalog_bus_departure_next: objectOutputSchema({
    atTime: dateTimeSchema,
    dayType: z.enum(["weekday", "weekend"]),
    totalRoutes: z.number().int().nonnegative(),
    departures: collectionOutputSchema(compactBusTripSchema),
    nextAvailableDeparture: compactBusTripSchema.nullable(),
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
    hasData: z.boolean(),
    message: z.string().nullable(),
  }),

  catalog_course_search: paginatedCourseMcpSchema,
  catalog_course_get: objectOutputSchema({
    course: compactCourseSchema.nullable(),
  }),
  catalog_semester_list: paginatedSemesterMcpSchema,
  catalog_semester_current: objectOutputSchema({
    semester: compactSemesterSchema.nullable(),
  }),

  catalog_section_get: objectOutputSchema({ section: compactSectionSchema }),
  catalog_section_search: paginatedSectionMcpSchema,
  catalog_section_match_preview: matchSectionCodesMcpSchema,

  catalog_teacher_search: paginatedTeacherMcpSchema,
  catalog_teacher_get: objectOutputSchema({
    teacher: compactTeacherSchema.nullable(),
  }),

  catalog_schedule_list: paginatedScheduleMcpSchema,
  catalog_section_schedule_list: objectOutputSchema({
    section: compactSectionSchema,
    schedules: collectionOutputSchema(compactScheduleSchema),
  }),
  workspace_schedule_list: objectOutputSchema({
    schedules: collectionOutputSchema(compactScheduleSchema),
  }),

  catalog_section_exam_list: objectOutputSchema({
    section: compactSectionSchema,
    exams: collectionOutputSchema(compactExamSchema),
  }),
  workspace_exam_list: objectOutputSchema({
    exams: collectionOutputSchema(compactExamSchema),
  }),
};

export function getMcpToolOutputSchema(name: string): McpToolOutputSchema {
  return TOOL_OUTPUT_SCHEMAS[name] ?? STRUCTURED_CONTENT_OUTPUT_SCHEMA;
}

export function getMarkdownMcpToolOutputSchemaForMode(
  name: keyof typeof MARKDOWN_MODE_OUTPUT_SCHEMAS,
  mode: "default" | "full",
): McpToolOutputSchema {
  return MARKDOWN_MODE_OUTPUT_SCHEMAS[name][mode];
}

export function hasMcpToolOutputSchema(name: string): boolean {
  return Object.hasOwn(TOOL_OUTPUT_SCHEMAS, name);
}

export function getMcpToolOutputSchemaNames(): string[] {
  return Object.keys(TOOL_OUTPUT_SCHEMAS);
}
