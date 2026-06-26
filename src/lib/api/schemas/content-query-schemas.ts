import * as z from "zod";
import { commentTargetQueryInputSchema } from "@/features/comments/lib/comment-target-input-schemas";
import {
  descriptionTargetTypeSchema,
  integerStringSchema,
} from "./request-schema-primitives";

export const commentsQuerySchema = commentTargetQueryInputSchema;

export const descriptionsQuerySchema = z.object({
  targetType: descriptionTargetTypeSchema,
  targetId: z.string().trim().min(1).optional(),
  sectionJwId: integerStringSchema.optional(),
  courseJwId: integerStringSchema.optional(),
  teacherId: integerStringSchema.optional(),
  homeworkId: z.string().trim().min(1).optional(),
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
