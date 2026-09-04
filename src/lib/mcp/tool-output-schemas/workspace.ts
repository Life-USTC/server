import { z } from "zod";
import { successResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";
import {
  calendarFeedOutputSchema,
  calendarMutationOutputSchema,
  calendarSubscriptionBriefSchema,
  calendarSubscriptionReadSchema,
  compactLocalizedSubscriptionSectionSchema,
  compactTodoSchema,
  compactWorkspaceExamSchema,
  compactWorkspaceHomeworkSchema,
  compactWorkspaceScheduleSchema,
  exactFailureOutputSchema,
  exactSuccessOutput,
  fullCalendarSubscriptionMutationSchema,
  fullCalendarSubscriptionReadSchema,
  importSemesterSummarySchema,
  type McpToolOutputSchema,
  objectOutputSchema,
  objectOutputSchemaFromApi,
  subscribedExamMcpSchema,
  subscribedExamSchema,
  subscribedScheduleEntryMcpSchema,
  subscribedScheduleEntrySchema,
  subscriptionFullSectionSchema,
  subscriptionImportOutputSchema,
  todoListMcpSchema,
  topLevelOutputSchema,
  uploadDeleteResponseSchema,
  uploadListMcpSchema,
  uploadRenameResponseSchema,
  workspaceHomeworkFullSchema,
} from "./shared";

export const workspaceAcademicModeOutputSchemas = {
  workspace_schedule_list: {
    default: z.union([
      exactSuccessOutput({
        schedules: z.array(compactWorkspaceScheduleSchema),
      }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({ schedules: z.array(subscribedScheduleEntrySchema) }),
      exactFailureOutputSchema,
    ]),
  },
  workspace_exam_list: {
    default: z.union([
      exactSuccessOutput({ exams: z.array(compactWorkspaceExamSchema) }),
      exactFailureOutputSchema,
    ]),
    full: z.union([
      exactSuccessOutput({ exams: z.array(subscribedExamSchema) }),
      exactFailureOutputSchema,
    ]),
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

export type WorkspaceAcademicModeToolName =
  keyof typeof workspaceAcademicModeOutputSchemas;

export const workspaceAdvertisedOutputSchemas: Record<
  WorkspaceAcademicModeToolName,
  McpToolOutputSchema
> = {
  workspace_schedule_list: objectOutputSchema({
    schedules: z.array(
      z.union([
        compactWorkspaceScheduleSchema,
        subscribedScheduleEntryMcpSchema,
      ]),
    ),
  }),
  workspace_exam_list: objectOutputSchema({
    exams: z.array(
      z.union([compactWorkspaceExamSchema, subscribedExamMcpSchema]),
    ),
  }),
};

export const workspaceNonAcademicModeOutputSchemas = {
  workspace_homework_list: {
    default: exactSuccessOutput({
      homeworks: z.array(compactWorkspaceHomeworkSchema),
    }),
    full: exactSuccessOutput({
      homeworks: z.array(workspaceHomeworkFullSchema),
    }),
  },
  workspace_calendar_feed_get: {
    default: calendarFeedOutputSchema(calendarSubscriptionReadSchema),
    full: calendarFeedOutputSchema(fullCalendarSubscriptionReadSchema),
  },
  workspace_subscription_list: {
    default: z.strictObject({
      success: z.boolean(),
      sections: z.array(compactLocalizedSubscriptionSectionSchema),
      note: z.string(),
    }),
    full: z.strictObject({
      success: z.boolean(),
      sections: z.array(subscriptionFullSectionSchema),
      note: z.string(),
    }),
  },
  workspace_subscription_add: {
    default: calendarMutationOutputSchema(calendarSubscriptionBriefSchema),
    full: calendarMutationOutputSchema(fullCalendarSubscriptionMutationSchema),
  },
  workspace_subscription_remove: {
    default: calendarMutationOutputSchema(calendarSubscriptionBriefSchema),
    full: calendarMutationOutputSchema(fullCalendarSubscriptionMutationSchema),
  },
  workspace_subscription_import: {
    default: subscriptionImportOutputSchema(calendarSubscriptionBriefSchema),
    full: subscriptionImportOutputSchema(
      fullCalendarSubscriptionMutationSchema,
    ),
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

function advertisedWorkspaceOutputSchema(name: WorkspaceAcademicModeToolName) {
  return workspaceAdvertisedOutputSchemas[name];
}

export const workspaceToolOutputSchemas: Record<string, McpToolOutputSchema> = {
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
    homeworks: z.array(
      z.union([compactWorkspaceHomeworkSchema, workspaceHomeworkFullSchema]),
    ),
  }),
  workspace_homework_completion_set: topLevelOutputSchema(["completion"]),

  workspace_calendar_feed_get: objectOutputSchema({
    subscription: z
      .union([
        calendarSubscriptionReadSchema,
        fullCalendarSubscriptionReadSchema,
      ])
      .nullable(),
  }),
  workspace_subscription_list: objectOutputSchema({
    sections: z.array(
      z.union([
        compactLocalizedSubscriptionSectionSchema,
        subscriptionFullSectionSchema,
      ]),
    ),
    note: z.string(),
  }),
  workspace_subscription_add: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: z
      .union([
        calendarSubscriptionBriefSchema,
        fullCalendarSubscriptionMutationSchema,
      ])
      .nullable(),
  }),
  workspace_subscription_remove: objectOutputSchema({
    action: z.string(),
    sectionJwId: z.number().int(),
    subscription: z
      .union([
        calendarSubscriptionBriefSchema,
        fullCalendarSubscriptionMutationSchema,
      ])
      .nullable(),
  }),
  workspace_subscription_import: objectOutputSchema({
    semester: importSemesterSummarySchema,
    matchedCodes: z.array(z.string()),
    unmatchedCodes: z.array(z.string()),
    addedCount: z.number().int().nonnegative(),
    alreadySubscribedCount: z.number().int().nonnegative(),
    subscription: z
      .union([
        calendarSubscriptionBriefSchema,
        fullCalendarSubscriptionMutationSchema,
      ])
      .nullable(),
  }),

  workspace_calendar_event_list: topLevelOutputSchema(["events"]),
  workspace_calendar_timeline_get: topLevelOutputSchema([
    "range",
    "total",
    "events",
  ]),

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
  workspace_schedule_list: advertisedWorkspaceOutputSchema(
    "workspace_schedule_list",
  ),
  workspace_exam_list: advertisedWorkspaceOutputSchema("workspace_exam_list"),
};
