import * as z from "zod";
import {
  commentReactionTypeSchema,
  commentTargetTypeSchema,
  commentVisibilitySchema,
} from "./request-schema-primitives";

const commentTargetIdReferenceSchema = z.union([z.string(), z.number()]);

export const commentCreateRequestSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: commentTargetIdReferenceSchema.optional(),
  sectionId: commentTargetIdReferenceSchema.optional(),
  sectionJwId: commentTargetIdReferenceSchema.optional(),
  courseJwId: commentTargetIdReferenceSchema.optional(),
  teacherId: commentTargetIdReferenceSchema.optional(),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: commentTargetIdReferenceSchema.optional(),
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
