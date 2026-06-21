import * as z from "zod";
import { subscribedExamSchema } from "./academic-exam-response-schemas";
import { homeworkItemSchema } from "./homeworks-response-schemas";
import {
  todoCountsSchema,
  viewerContextSchema,
} from "./misc-response-schema-core";
import { dateTimeSchema } from "./response-schema-primitives";
import { scheduleEntrySchema } from "./schedule-response-schema-core";

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
    homeworkWindowDays: z.number().int().positive(),
    homeworkWindowEnd: dateTimeSchema,
    limit: z.number().int().positive(),
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
        priority: z.enum(["low", "medium", "high"]),
        completed: z.boolean(),
        dueAt: dateTimeSchema.nullable(),
        createdAt: dateTimeSchema,
        updatedAt: dateTimeSchema,
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
