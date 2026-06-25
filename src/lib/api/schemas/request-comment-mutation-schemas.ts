import * as z from "zod";
import {
  commentReactionTypeSchema,
  commentTargetTypeSchema,
  commentVisibilitySchema,
  parseOptionalInt,
} from "./request-schema-primitives";

const commentTargetIdReferenceSchema = z.union([z.string(), z.number()]);

const positiveIntegerTargetIdReferenceSchema = z.union([
  z
    .string()
    .trim()
    .refine(
      (value) => {
        const parsed = parseOptionalInt(value);
        return parsed !== null && parsed > 0;
      },
      { message: "Invalid integer" },
    )
    .meta({ override: { type: "integer", format: "int64", minimum: 1 } }),
  z
    .number()
    .int()
    .min(1)
    .meta({ override: { type: "integer", minimum: 1 } }),
]);

export const commentCreateRequestSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: commentTargetIdReferenceSchema.optional(),
  sectionId: commentTargetIdReferenceSchema.optional(),
  sectionJwId: positiveIntegerTargetIdReferenceSchema.optional(),
  courseJwId: positiveIntegerTargetIdReferenceSchema.optional(),
  teacherId: commentTargetIdReferenceSchema.optional(),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: positiveIntegerTargetIdReferenceSchema.optional(),
  body: z.string().trim().min(1).max(8000),
  visibility: commentVisibilitySchema.optional(),
  isAnonymous: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
  attachmentIds: z.array(z.string()).optional(),
});

export const commentUpdateRequestSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  visibility: commentVisibilitySchema.optional(),
  isAnonymous: z.boolean().optional(),
  attachmentIds: z.array(z.string()).optional(),
});

export const commentReactionRequestSchema = z.object({
  type: commentReactionTypeSchema,
});
