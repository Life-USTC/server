import * as z from "zod";
import {
  localizedCourseBaseSchema,
  sectionBaseSchema,
  semesterSchema,
} from "./academic-response-schema-core";
import { viewerContextSchema } from "./misc-response-schema-core";
import {
  createPaginatedSchema,
  dateTimeSchema,
} from "./response-schema-primitives";
import { homeworkAuditActionSchema } from "./shared-enum-schemas";

export const homeworkUserSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

const homeworkDescriptionSchema = z.strictObject({
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

export const homeworkItemSchema = z.strictObject({
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
    .strictObject({
      completedAt: dateTimeSchema,
    })
    .nullable(),
  commentCount: z.number().int().nonnegative(),
});

export const homeworkSummarySchema = homeworkItemSchema.omit({
  section: true,
  description: true,
  createdBy: true,
  updatedBy: true,
  deletedBy: true,
});

const homeworkAuditLogSchema = z.strictObject({
  id: z.string(),
  action: homeworkAuditActionSchema,
  titleSnapshot: z.string().nullable(),
  createdAt: dateTimeSchema,
  sectionId: z.number().int(),
  homeworkId: z.string().nullable(),
  actorId: z.string().nullable(),
  actor: homeworkUserSummarySchema.nullable(),
});

export const homeworkAuditListResponseSchema = z.strictObject({
  auditLogs: z.array(homeworkAuditLogSchema),
});

export const homeworksListResponseSchema = createPaginatedSchema(
  homeworkSummarySchema,
).extend({ viewer: viewerContextSchema });

export const homeworkDetailResponseSchema = z.strictObject({
  homework: homeworkItemSchema,
  auditLogs: z.array(homeworkAuditLogSchema),
});

export const homeworkCreateResponseSchema = z.strictObject({
  id: z.string(),
  homework: homeworkItemSchema,
});

export const homeworkUpdateResponseSchema = z.strictObject({
  success: z.boolean(),
  homework: homeworkItemSchema,
});

export const homeworkCompletionResponseSchema = z.strictObject({
  completed: z.boolean(),
  completedAt: dateTimeSchema.nullable(),
});

export const homeworkCompletionBatchResponseSchema = z.strictObject({
  results: z.array(
    z.discriminatedUnion("success", [
      z.strictObject({
        success: z.literal(true),
        homeworkId: z.string(),
        completed: z.boolean(),
        completedAt: dateTimeSchema.nullable(),
      }),
      z.strictObject({
        success: z.literal(false),
        homeworkId: z.string(),
        completed: z.boolean(),
        error: z.strictObject({
          code: z.enum(["not_found", "deleted"]),
          message: z.string(),
        }),
      }),
    ]),
  ),
});

export const subscribedHomeworksResponseSchema =
  createPaginatedSchema(homeworkItemSchema);
