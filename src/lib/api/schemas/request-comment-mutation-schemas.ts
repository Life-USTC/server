import * as z from "zod";
import { commentTargetMutationInputSchema } from "@/features/comments/lib/comment-target-input-schemas";
import {
  commentReactionTypeSchema,
  commentVisibilitySchema,
} from "./request-schema-primitives";

export const commentCreateRequestSchema =
  commentTargetMutationInputSchema.extend({
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

export const commentBatchDeleteRequestSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(50),
});
