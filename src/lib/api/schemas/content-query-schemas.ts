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
  teacherId: integerStringSchema.optional(),
});

export const descriptionsQuerySchema = z.object({
  targetType: descriptionTargetTypeSchema,
  targetId: z.string().trim().min(1),
});

export const homeworksQuerySchema = z.object({
  sectionId: integerStringSchema.optional(),
  sectionIds: z.string().trim().min(1).optional(),
  includeDeleted: z.enum(["true", "false"]).optional(),
});

export const sectionsCalendarQuerySchema = z.object({
  sectionIds: z.string().trim().min(1),
});
