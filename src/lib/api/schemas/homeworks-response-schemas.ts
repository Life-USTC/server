import * as z from "zod";
import {
  localizedCourseBaseSchema,
  sectionBaseSchema,
  semesterSchema,
} from "./academic-response-schema-core";
import { viewerContextSchema } from "./misc-response-schema-core";
import { dateTimeSchema } from "./response-schema-primitives";
import { homeworkAuditActionSchema } from "./shared-enum-schemas";

export const homeworkUserSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

const homeworkDescriptionSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  lastEditedAt: dateTimeSchema.nullable(),
  lastEditedById: z.string().nullable(),
  sectionId: z.number().int().nullable(),
  courseId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  homeworkId: z.string().nullable(),
});

const homeworkListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  isMajor: z.boolean(),
  requiresTeam: z.boolean(),
  publishedAt: dateTimeSchema.nullable(),
  submissionStartAt: dateTimeSchema.nullable(),
  submissionDueAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  deletedAt: dateTimeSchema.nullable(),
  sectionId: z.number().int(),
  createdById: z.string().nullable(),
  updatedById: z.string().nullable(),
  deletedById: z.string().nullable(),
  section: sectionBaseSchema.extend({
    course: localizedCourseBaseSchema,
    semester: semesterSchema.nullable(),
  }),
  description: homeworkDescriptionSchema.nullable(),
  createdBy: homeworkUserSummarySchema.nullable(),
  updatedBy: homeworkUserSummarySchema.nullable(),
  deletedBy: homeworkUserSummarySchema.nullable(),
  completion: z
    .object({
      completedAt: dateTimeSchema,
    })
    .nullable(),
  commentCount: z.number().int().nonnegative(),
});

const homeworkAuditLogSchema = z.object({
  id: z.string(),
  action: homeworkAuditActionSchema,
  titleSnapshot: z.string(),
  createdAt: dateTimeSchema,
  sectionId: z.number().int(),
  homeworkId: z.string().nullable(),
  actorId: z.string().nullable(),
  actor: homeworkUserSummarySchema.nullable(),
});

export const homeworksListResponseSchema = z.object({
  viewer: viewerContextSchema,
  homeworks: z.array(homeworkListItemSchema),
  auditLogs: z.array(homeworkAuditLogSchema),
});

export const homeworkCompletionResponseSchema = z.object({
  completed: z.boolean(),
  completedAt: dateTimeSchema.nullable(),
});

export const homeworkCompletionBatchResponseSchema = z.object({
  results: z.array(
    z.discriminatedUnion("success", [
      z.object({
        success: z.literal(true),
        homeworkId: z.string(),
        completed: z.boolean(),
        completedAt: dateTimeSchema.nullable(),
      }),
      z.object({
        success: z.literal(false),
        homeworkId: z.string(),
        completed: z.boolean(),
        error: z.object({
          code: z.enum(["not_found", "deleted"]),
          message: z.string(),
        }),
      }),
    ]),
  ),
});

export const subscribedHomeworksResponseSchema = z.object({
  viewer: viewerContextSchema,
  homeworks: z.array(homeworkListItemSchema),
  auditLogs: z.array(homeworkAuditLogSchema),
  sectionIds: z.array(z.number().int()),
});
