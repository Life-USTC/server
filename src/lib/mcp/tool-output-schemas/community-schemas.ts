import { z } from "zod";
import { sectionPublicContextSchema } from "@/lib/api/schemas/academic-section-list-response-schemas";
import { homeworkItemSchema } from "@/lib/api/schemas/homeworks-response-schemas";
import { dateTimeSchema } from "@/lib/api/schemas/response-schema-primitives";
import {
  compactCourseSchema,
  compactSemesterSchema,
  compactUserSchema,
  exactFailureOutputSchema,
  exactSuccessOutput,
} from "./builders";

export const publicProfileFullUserSchema = compactUserSchema.extend({
  createdAt: dateTimeSchema,
  _count: z.strictObject({
    comments: z.number().int().nonnegative(),
    homeworksCreated: z.number().int().nonnegative(),
    subscribedSections: z.number().int().nonnegative(),
    uploads: z.number().int().nonnegative(),
  }),
});

export const contributionWeeksSchema = z.array(
  z.array(
    z.strictObject({
      date: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
);

export const compactHomeworkSectionSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  code: z.string(),
  campusId: z.number().int().nullable(),
  openDepartmentId: z.number().int().nullable(),
  course: compactCourseSchema,
  semester: compactSemesterSchema.nullable(),
});

export const compactHomeworkDescriptionSchema = z.strictObject({
  id: z.string(),
  content: z.string(),
  lastEditedAt: dateTimeSchema.nullable(),
  lastEditedById: z.string().nullable(),
});

export const compactHomeworkSchema = z.strictObject({
  id: z.string(),
  sectionId: z.number().int(),
  title: z.string(),
  isMajor: z.boolean(),
  requiresTeam: z.boolean(),
  publishedAt: dateTimeSchema.nullable(),
  submissionStartAt: dateTimeSchema.nullable(),
  submissionDueAt: dateTimeSchema.nullable(),
  deletedAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  description: compactHomeworkDescriptionSchema.nullable(),
  section: compactHomeworkSectionSchema,
  createdBy: compactUserSchema.nullable(),
  updatedBy: compactUserSchema.nullable(),
  deletedBy: compactUserSchema.nullable(),
  completion: z.strictObject({ completedAt: dateTimeSchema }).nullable(),
  commentCount: z.number().int().nonnegative(),
});

export const homeworkItemFullMcpSchema = homeworkItemSchema
  .extend({
    section: homeworkItemSchema.shape.section.extend({
      semester: compactSemesterSchema.nullable(),
    }),
  })
  .strict();

export const compactSectionHomeworkItemSchema = compactHomeworkSchema.omit({
  section: true,
  description: true,
  createdBy: true,
  updatedBy: true,
  deletedBy: true,
});

export const sectionHomeworkNotFoundSchema = z.strictObject({
  success: z.literal(false),
  found: z.literal(false),
  message: z.string(),
  hint: z.string(),
});

export const sectionHomeworkListDefaultSchema = z.union([
  z.strictObject({
    success: z.literal(true),
    found: z.literal(true),
    section: sectionPublicContextSchema,
    homeworks: z.array(compactSectionHomeworkItemSchema),
  }),
  sectionHomeworkNotFoundSchema,
]);

export const sectionHomeworkListFullSchema = z.union([
  z.strictObject({
    success: z.literal(true),
    found: z.literal(true),
    section: sectionPublicContextSchema,
    homeworks: z.array(compactSectionHomeworkItemSchema),
  }),
  sectionHomeworkNotFoundSchema,
]);

export const homeworkMutationFailureSchema = z.union([
  z.strictObject({ success: z.literal(false), message: z.string() }),
  z.strictObject({
    success: z.literal(false),
    message: z.string(),
    reason: z.string().nullable(),
  }),
  exactFailureOutputSchema,
]);

export const homeworkCreateDefaultSchema = z.union([
  exactSuccessOutput({ id: z.string(), homework: compactHomeworkSchema }),
  homeworkMutationFailureSchema,
]);
export const homeworkCreateFullSchema = z.union([
  exactSuccessOutput({ id: z.string(), homework: homeworkItemFullMcpSchema }),
  homeworkMutationFailureSchema,
]);
export const homeworkUpdateDefaultSchema = z.union([
  exactSuccessOutput({ homework: compactHomeworkSchema }),
  homeworkMutationFailureSchema,
]);
export const homeworkUpdateFullSchema = z.union([
  exactSuccessOutput({ homework: homeworkItemFullMcpSchema }),
  homeworkMutationFailureSchema,
]);

export function publicProfileOutputSchema(userSchema: z.ZodType) {
  return z.union([
    exactSuccessOutput({
      found: z.literal(true),
      user: userSchema,
      sectionCount: z.number().int().nonnegative(),
      weeks: contributionWeeksSchema,
      totalContributions: z.number().int().nonnegative(),
    }),
    z.strictObject({
      success: z.literal(false),
      found: z.literal(false),
      error: z.literal("not_found"),
      message: z.string(),
    }),
  ]);
}
