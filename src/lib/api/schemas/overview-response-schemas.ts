import * as z from "zod";
import { todoPrioritySchema } from "@/features/todos/lib/todo-schema";
import { subscribedExamSchema } from "./academic-exam-response-schemas";
import { homeworkItemSchema } from "./homeworks-response-schemas";
import {
  todoCountsSchema,
  viewerContextSchema,
} from "./misc-response-schema-core";
import { dateTimeSchema } from "./response-schema-primitives";
import { scheduleEntrySchema } from "./schedule-response-schema-core";
import { personalCalendarItemSchema } from "./young-workspace-schemas";

export const compactOverviewResponseSchema = z.object({
  user: viewerContextSchema.pick({
    userId: true,
    name: true,
    image: true,
    isAdmin: true,
  }),
  anchor: z.object({
    atTime: dateTimeSchema,
    todayStart: dateTimeSchema,
    tomorrowStart: dateTimeSchema,
    homeworkWindowDays: z.number().int().min(1),
    homeworkWindowEnd: dateTimeSchema,
    limit: z.number().int().min(1),
  }),
  counts: z.object({
    todos: todoCountsSchema,
    pendingHomeworks: z.number().int().nonnegative(),
    dueSoonHomeworks: z.number().int().nonnegative(),
    todaySchedules: z.number().int().nonnegative(),
    upcomingExams: z.number().int().nonnegative(),
  }),
  schedules: z.object({
    total: z.number().int().nonnegative(),
    items: z.array(scheduleEntrySchema),
  }),
  todos: z.object({
    counts: todoCountsSchema,
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string().nullable(),
        priority: todoPrioritySchema,
        completed: z.boolean(),
        dueAt: dateTimeSchema.nullable(),
        createdAt: dateTimeSchema,
        updatedAt: dateTimeSchema,
      }),
    ),
  }),
  dueTodos: z.object({
    total: z.number().int().nonnegative(),
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        priority: todoPrioritySchema,
        dueAt: dateTimeSchema,
        createdAt: dateTimeSchema,
      }),
    ),
  }),
  homeworks: z.object({
    total: z.number().int().nonnegative(),
    items: z.array(homeworkItemSchema),
  }),
  exams: z.object({
    total: z.number().int().nonnegative(),
    items: z.array(subscribedExamSchema),
  }),
});

export const actionableOverviewResponseSchema = z.object({
  anchor: z.object({
    atTime: dateTimeSchema,
    dateFrom: dateTimeSchema,
    dateTo: dateTimeSchema,
  }),
  focus: personalCalendarItemSchema
    .extend({ status: z.enum(["now", "urgent", "next"]) })
    .nullable(),
  urgency: z.array(personalCalendarItemSchema),
  upcoming: z.array(personalCalendarItemSchema),
  deadlines: z.object({
    today: z.array(personalCalendarItemSchema),
    nextThreeDays: z.array(personalCalendarItemSchema),
    allPending: z.array(personalCalendarItemSchema),
  }),
  subscriptions: z.object({
    totalCount: z.number().int().nonnegative(),
    currentSemesterCount: z.number().int().nonnegative(),
    currentSemester: z
      .object({
        id: z.number().int(),
        nameCn: z.string(),
        startDate: dateTimeSchema,
        endDate: dateTimeSchema,
      })
      .nullable(),
  }),
});
