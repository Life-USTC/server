import { z } from "zod";
import {
  examBatchSchema,
  examRoomSchema,
} from "@/lib/api/schemas/academic-exam-response-schemas";
import { campusSchema } from "@/lib/api/schemas/academic-location-response-schemas";
import {
  departmentSchema,
  teacherTitleSchema,
} from "@/lib/api/schemas/academic-teacher-response-schemas";
import { busPreferenceResponseSchema } from "@/lib/api/schemas/bus-response-schemas";
import { compactOverviewResponseSchema } from "@/lib/api/schemas/overview-response-schemas";
import { youngEventSummarySchema } from "@/lib/api/schemas/young-event-schemas";
import {
  compactSemesterSchema,
  compactUserSchema,
  dateTimeSchema,
  objectOutputSchema,
} from "./builders";
import { compactBusTripSchema } from "./bus";
import {
  compactScheduleSchema,
  compactScheduleTeacherSchema,
} from "./catalog-schemas";
import { homeworkItemFullMcpSchema } from "./community-schemas";
import {
  compactTodoSchema,
  persistedLocalizedLabelSchema,
  subscribedExamMcpSchema,
  subscribedScheduleEntryMcpSchema,
  subscriptionFullCourseSchema,
  workspaceHomeworkFullSectionSchema,
} from "./workspace-schemas";

const count = z.number().int().nonnegative();
const localizedLabel = persistedLocalizedLabelSchema
  .extend({
    namePrimary: z.string().optional(),
    nameSecondary: z.string().nullable().optional(),
  })
  .partial();
const calendarCourseSchema = subscriptionFullCourseSchema.partial().extend({
  category: localizedLabel.nullable().optional(),
  classType: localizedLabel.nullable().optional(),
  classify: localizedLabel.nullable().optional(),
  educationLevel: localizedLabel.nullable().optional(),
  gradation: localizedLabel.nullable().optional(),
  type: localizedLabel.nullable().optional(),
});
const calendarTeacherSchema = compactScheduleTeacherSchema.partial().extend({
  department: departmentSchema.partial().nullable().optional(),
  teacherTitle: teacherTitleSchema.partial().nullable().optional(),
  _count: z.strictObject({ sections: count }).optional(),
});
const calendarSectionSchema = workspaceHomeworkFullSectionSchema
  .partial()
  .extend({
    course: calendarCourseSchema.optional(),
    semester: compactSemesterSchema.partial().nullable().optional(),
    campus: campusSchema.partial().nullable().optional(),
    openDepartment: departmentSchema.partial().nullable().optional(),
    examMode: localizedLabel.nullable().optional(),
    teachLanguage: localizedLabel.nullable().optional(),
    teachers: z.array(calendarTeacherSchema).optional(),
  });
const calendarScheduleSchema = subscribedScheduleEntryMcpSchema
  .partial()
  .extend({
    startTime: z.number().int().nullable().optional(),
    endTime: z.number().int().nullable().optional(),
    section: calendarSectionSchema.optional(),
    teachers: z.array(calendarTeacherSchema).optional(),
    teacherParticipations: z
      .array(
        z.strictObject({
          teacher: calendarTeacherSchema,
          periods: z.number().nullable(),
          exerciseClass: z.boolean().nullable(),
        }),
      )
      .optional(),
    room: z
      .union([
        compactScheduleSchema.shape.room.unwrap(),
        subscribedScheduleEntryMcpSchema.shape.room,
      ])
      .nullable()
      .optional(),
  });
const calendarHomeworkSchema = homeworkItemFullMcpSchema.partial().extend({
  section: calendarSectionSchema.optional(),
  description: homeworkItemFullMcpSchema.shape.description
    .unwrap()
    .partial()
    .nullable()
    .optional(),
});
const calendarExamSchema = subscribedExamMcpSchema.partial().extend({
  section: calendarSectionSchema.optional(),
  examBatch: examBatchSchema.partial().nullable().optional(),
  examRooms: z.array(examRoomSchema.partial()).optional(),
});

// Calendar event payloads are closed domain projections, selected by event type.
// Cards omit known low-priority fields; full payloads use the shared API schemas.
export const workspaceEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("schedule"),
    at: dateTimeSchema.nullable(),
    endsAt: dateTimeSchema.nullable().optional(),
    payload: calendarScheduleSchema,
  }),
  z.strictObject({
    type: z.literal("homework_due"),
    at: dateTimeSchema.nullable(),
    endsAt: dateTimeSchema.nullable().optional(),
    payload: calendarHomeworkSchema,
  }),
  z.strictObject({
    type: z.literal("exam"),
    at: dateTimeSchema.nullable(),
    endsAt: dateTimeSchema.nullable().optional(),
    payload: calendarExamSchema,
  }),
  z.strictObject({
    type: z.literal("todo_due"),
    at: dateTimeSchema.nullable(),
    endsAt: dateTimeSchema.nullable().optional(),
    payload: compactTodoSchema,
  }),
  z.strictObject({
    type: z.literal("young_event"),
    at: dateTimeSchema.nullable(),
    endsAt: dateTimeSchema.nullable().optional(),
    payload: youngEventSummarySchema,
  }),
]);
const eventCollectionSchema = z.strictObject({
  total: count,
  items: z.array(workspaceEventSchema),
});
const currentSemesterSchema = compactSemesterSchema.partial().nullable();
const pinsShape = { pinnedSlugs: z.array(z.string()), maxPinnedLinks: count };

export const workspaceAggregateOutputSchemas = {
  workspace_homework_completion_set: objectOutputSchema({
    completion: z.strictObject({
      homeworkId: z.string(),
      completed: z.boolean(),
      completedAt: dateTimeSchema.nullable(),
    }),
  }),
  workspace_calendar_event_list: objectOutputSchema({
    events: z.array(workspaceEventSchema),
  }),
  workspace_calendar_timeline_get: objectOutputSchema({
    range: z.strictObject({ from: dateTimeSchema, to: dateTimeSchema }),
    total: count,
    events: z.array(workspaceEventSchema),
  }),
  workspace_snapshot_get: objectOutputSchema({
    user: compactUserSchema,
    currentSemester: currentSemesterSchema,
    subscriptions: z.strictObject({
      totalCount: count,
      currentSemesterCount: count,
      currentSemesterSectionsTotal: count,
      currentSemesterSections: z.array(calendarSectionSchema),
    }),
    nextClass: workspaceEventSchema.nullable(),
    upcomingDeadlines: eventCollectionSchema,
    upcomingEvents: eventCollectionSchema,
    todos: z.strictObject({
      incompleteCount: count,
      items: z.array(compactTodoSchema),
    }),
    bus: z.strictObject({
      hasPreference: z.boolean(),
      preference: busPreferenceResponseSchema.shape.preference.nullable(),
      nextDeparture: compactBusTripSchema.nullable(),
      departures: z.array(compactBusTripSchema),
    }),
  }),
  workspace_link_pin_list: objectOutputSchema(pinsShape),
  workspace_link_pin_set: objectOutputSchema({
    ...pinsShape,
    action: z.enum(["pin", "unpin"]),
    slug: z.string(),
  }),
  workspace_deadline_list: objectOutputSchema({
    total: count,
    deadlines: z.array(workspaceEventSchema),
  }),
  workspace_overview_get: objectOutputSchema({
    user: compactUserSchema
      .partial()
      .extend({ isAdmin: z.boolean().optional() }),
    overview: z.strictObject({
      pendingTodosCount: count,
      pendingHomeworksCount: count,
      todaySchedulesCount: count,
      upcomingExamsCount: count,
    }),
    samples: z.strictObject({
      dueTodos: z.array(
        compactOverviewResponseSchema.shape.dueTodos.shape.items.element.extend(
          {
            createdAt: dateTimeSchema.optional(),
          },
        ),
      ),
      dueHomeworks: z.array(calendarHomeworkSchema),
      upcomingExams: z.array(calendarExamSchema),
    }),
  }),
  workspace_schedule_next: objectOutputSchema({
    nextClass: workspaceEventSchema.nullable(),
    currentSemester: currentSemesterSchema,
  }),
};
