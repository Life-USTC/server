import { z } from "zod";
import {
  paginatedCourseResponseSchema,
  paginatedSectionResponseSchema,
  paginatedSemesterResponseSchema,
  paginatedTeacherResponseSchema,
} from "@/lib/api/schemas/academic-paginated-response-schemas";
import {
  matchSectionCodesResponseSchema,
  meResponseSchema,
  successResponseSchema,
  todoCountsSchema,
  todoItemSchema,
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
  success: z.boolean().optional(),
  found: z.boolean().optional(),
  error: z.unknown().optional(),
  message: z.string().optional(),
  hint: z.string().optional(),
  result: z.unknown().optional(),
} satisfies OutputShape;

export const STRUCTURED_CONTENT_OUTPUT_SCHEMA = z
  .object(COMMON_OUTPUT_SHAPE)
  .catchall(z.unknown())
  .describe("Open object returned in structuredContent.");

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
    .catchall(z.unknown())
    .describe("Object returned in structuredContent.");
}

function objectOutputSchemaFromApi(schema: { shape: OutputShape }) {
  return objectOutputSchema(schema.shape);
}

function topLevelOutputSchema(keys: string[]) {
  return objectOutputSchema(
    Object.fromEntries(keys.map((key) => [key, z.unknown()])) as OutputShape,
  );
}

function collectionSummarySchema(itemSchema: z.ZodType) {
  return z
    .object({
      total: z.number().int().nonnegative(),
      returned: z.number().int().nonnegative().optional(),
      remaining: z.number().int().nonnegative().optional(),
      truncated: z.boolean().optional(),
      items: z.array(itemSchema).optional(),
    })
    .catchall(z.unknown());
}

function collectionOutputSchema(itemSchema: z.ZodType) {
  return z.union([z.array(itemSchema), collectionSummarySchema(itemSchema)]);
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
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  examType: z.string().nullable(),
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
  departureTime: z.string(),
  arrivalTime: z.string(),
  departureMinutes: z.number().int(),
  arrivalMinutes: z.number().int(),
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
  ...uploadsListResponseSchema.shape,
  uploads: collectionOutputSchema(uploadSummarySchema),
});

const matchSectionCodesMcpSchema = objectOutputSchema({
  ...matchSectionCodesResponseSchema.shape,
  success: z.boolean(),
  matchedCodes: collectionOutputSchema(z.string()),
  unmatchedCodes: collectionOutputSchema(z.string()),
  suggestions: z.record(
    z.string(),
    z.union([z.array(z.string()), collectionSummarySchema(z.string())]),
  ),
  sections: collectionOutputSchema(compactSectionSchema),
  note: z.string(),
});

// Keep fallback schemas top-level only until each mode has an explicit payload builder.
const TOOL_OUTPUT_SCHEMAS: Record<string, McpToolOutputSchema> = {
  get_my_profile: objectOutputSchemaFromApi(meResponseSchema),
  get_public_user_profile: objectOutputSchema({
    user: compactUserSchema,
    sectionCount: z.number().int().nonnegative(),
    weeks: z.unknown(),
    totalContributions: z.number().int().nonnegative(),
  }),
  list_my_todos: todoListMcpSchema,
  create_my_todo: objectOutputSchema({
    success: z.boolean(),
    id: z.string(),
  }),
  update_my_todo: objectOutputSchema({
    success: z.boolean(),
    todo: compactTodoSchema,
  }),
  delete_my_todo: objectOutputSchemaFromApi(successResponseSchema),

  list_my_homeworks: objectOutputSchema({
    homeworks: collectionOutputSchema(compactHomeworkSchema),
  }),
  set_my_homework_completion: topLevelOutputSchema(["completion"]),
  list_homeworks_by_section: objectOutputSchema({
    section: compactSectionSchema,
    homeworks: collectionOutputSchema(compactHomeworkSchema),
  }),
  create_homework_on_section: objectOutputSchema({
    id: z.string(),
    homework: compactHomeworkSchema,
    reason: z.string().nullable(),
  }),
  update_homework_on_section: objectOutputSchema({
    homework: compactHomeworkSchema,
    reason: z.string().nullable(),
  }),
  delete_homework_on_section: topLevelOutputSchema([
    "deletedId",
    "alreadyDeleted",
    "reason",
  ]),

  get_my_calendar_subscription: objectOutputSchema({
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  list_my_subscribed_sections: objectOutputSchema({
    sections: collectionOutputSchema(compactSectionSchema),
    note: z.string(),
  }),
  subscribe_section_by_jw_id: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  unsubscribe_section_by_jw_id: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  subscribe_my_sections_by_codes: objectOutputSchema({
    semester: compactSemesterSchema,
    matchedCodes: collectionOutputSchema(z.string()),
    unmatchedCodes: collectionOutputSchema(z.string()),
    addedCount: z.number().int().nonnegative(),
    alreadySubscribedCount: z.number().int().nonnegative(),
    subscription: compactCalendarSubscriptionSchema.nullable(),
  }),
  get_section_calendar_subscription: objectOutputSchema({
    section: compactSectionSchema.nullable(),
    calendarPath: z.string(),
    calendarUrl: z.string(),
  }),

  list_my_calendar_events: topLevelOutputSchema(["events"]),
  get_my_7days_timeline: topLevelOutputSchema(["range", "total", "events"]),

  list_comments: topLevelOutputSchema([
    "comments",
    "hiddenCount",
    "viewer",
    "target",
  ]),
  get_comment_thread: topLevelOutputSchema([
    "thread",
    "focusId",
    "hiddenCount",
    "viewer",
    "target",
  ]),
  create_comment: objectOutputSchema({ success: z.boolean(), id: z.string() }),
  update_own_comment: topLevelOutputSchema(["comment"]),
  delete_own_comment: objectOutputSchemaFromApi(successResponseSchema),
  add_comment_reaction: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),
  remove_comment_reaction: objectOutputSchema({
    success: z.boolean(),
    changed: z.boolean(),
  }),

  get_description: topLevelOutputSchema([
    "target",
    "description",
    "history",
    "viewer",
  ]),
  upsert_description: topLevelOutputSchema([
    "id",
    "updated",
    "target",
    "description",
    "history",
    "viewer",
  ]),

  list_my_uploads: uploadListMcpSchema,
  rename_my_upload: objectOutputSchema({
    ...uploadRenameResponseSchema.shape,
    success: z.boolean(),
    reason: z.string().nullable(),
  }),
  delete_my_upload: objectOutputSchema({
    ...uploadDeleteResponseSchema.shape,
    success: z.boolean(),
    reason: z.string().nullable(),
  }),

  get_my_dashboard: topLevelOutputSchema([
    "user",
    "currentSemester",
    "subscriptions",
    "nextClass",
    "upcomingDeadlines",
    "upcomingEvents",
    "todos",
    "bus",
  ]),
  list_dashboard_links: topLevelOutputSchema([
    "query",
    "total",
    "returned",
    "dashboardLinks",
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  set_dashboard_link_pin_state: topLevelOutputSchema([
    "action",
    "slug",
    "pinnedSlugs",
    "maxPinnedLinks",
  ]),
  get_upcoming_deadlines: topLevelOutputSchema(["total", "deadlines"]),
  get_my_overview: topLevelOutputSchema(["user", "overview", "samples"]),
  get_next_class: topLevelOutputSchema(["nextClass", "currentSemester"]),

  query_bus_timetable: objectOutputSchema({
    locale: z.string(),
    fetchedAt: dateTimeSchema,
    version: z.unknown(),
    counts: z.unknown(),
    campuses: collectionOutputSchema(compactCampusSchema),
    routes: collectionOutputSchema(compactBusRouteSchema),
    trips: collectionOutputSchema(compactBusTripSchema),
    preferences: z.unknown(),
    nextDepartures: collectionOutputSchema(compactBusTripSchema),
    nextDeparturesMessage: z.string().nullable(),
    notice: z.unknown(),
    hasData: z.boolean(),
  }),
  list_bus_routes: objectOutputSchema({
    locale: z.string(),
    version: z.unknown(),
    campuses: collectionOutputSchema(compactCampusSchema),
    routes: collectionOutputSchema(compactBusRouteSchema),
    notice: z.unknown(),
  }),
  get_bus_route_timetable: objectOutputSchema({
    routeId: z.number().int(),
    route: compactBusRouteSchema,
    version: z.unknown(),
    trips: collectionOutputSchema(compactBusTripSchema),
    stops: collectionOutputSchema(z.unknown()),
    hasData: z.boolean(),
  }),
  get_my_bus_preferences: topLevelOutputSchema(["preferences"]),
  save_my_bus_preferences: topLevelOutputSchema(["preferences"]),
  search_bus_routes: objectOutputSchema({
    routes: collectionOutputSchema(compactBusRouteSchema),
    trips: collectionOutputSchema(compactBusTripSchema),
    campuses: collectionOutputSchema(compactCampusSchema),
    hasData: z.boolean(),
  }),
  get_next_buses: objectOutputSchema({
    departures: collectionOutputSchema(compactBusTripSchema),
    nextAvailableDeparture: compactBusTripSchema.nullable(),
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
    hasData: z.boolean(),
  }),

  search_courses: paginatedCourseMcpSchema,
  get_course_by_jw_id: objectOutputSchema({ course: compactCourseSchema }),
  list_semesters: paginatedSemesterMcpSchema,
  get_current_semester: objectOutputSchema({ semester: compactSemesterSchema }),

  get_section_by_jw_id: objectOutputSchema({ section: compactSectionSchema }),
  search_sections: paginatedSectionMcpSchema,
  match_section_codes: matchSectionCodesMcpSchema,

  search_teachers: paginatedTeacherMcpSchema,
  get_teacher_by_id: objectOutputSchema({ teacher: compactTeacherSchema }),

  query_schedules: paginatedScheduleMcpSchema,
  list_schedules_by_section: objectOutputSchema({
    section: compactSectionSchema,
    schedules: collectionOutputSchema(compactScheduleSchema),
  }),
  list_my_schedules: objectOutputSchema({
    schedules: collectionOutputSchema(compactScheduleSchema),
  }),

  list_exams_by_section: objectOutputSchema({
    section: compactSectionSchema,
    exams: collectionOutputSchema(compactExamSchema),
  }),
  list_my_exams: objectOutputSchema({
    exams: collectionOutputSchema(compactExamSchema),
  }),
};

export function getMcpToolOutputSchema(name: string): McpToolOutputSchema {
  return TOOL_OUTPUT_SCHEMAS[name] ?? STRUCTURED_CONTENT_OUTPUT_SCHEMA;
}
