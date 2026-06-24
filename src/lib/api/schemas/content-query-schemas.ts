import * as z from "zod";
import {
  commentTargetTypeSchema,
  descriptionTargetTypeSchema,
  integerStringSchema,
} from "./request-schema-primitives";

export const commentsQuerySchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().optional(),
  sectionId: integerStringSchema.optional(),
  sectionJwId: integerStringSchema.optional(),
  courseJwId: integerStringSchema.optional(),
  teacherId: integerStringSchema.optional(),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: integerStringSchema.optional(),
});

export const descriptionsQuerySchema = z.object({
  targetType: descriptionTargetTypeSchema,
  targetId: z.string().trim().min(1),
});

export const homeworksQuerySchema = z.object({
  sectionId: integerStringSchema.optional(),
  sectionIds: z.string().trim().min(1).optional(),
  sectionJwId: integerStringSchema.optional(),
  includeDeleted: z.enum(["true", "false"]).optional(),
});

export const sectionsCalendarQuerySchema = z.object({
  sectionIds: z.string().trim().min(1),
});

export const userCalendarQuerySchema = z.object({
  token: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Calendar feed token for anonymous personal iCal access."),
});
