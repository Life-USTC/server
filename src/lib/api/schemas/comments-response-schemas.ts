import * as z from "zod";
import { commentNodeSchema } from "./comment-node-response-schema";
import {
  commentListTargetSchema,
  commentThreadTargetSchema,
} from "./comment-target-response-schema";
import { viewerContextSchema } from "./misc-response-schema-core";

export const commentsListResponseSchema = z.object({
  comments: z.array(commentNodeSchema),
  hiddenCount: z.number().int().nonnegative(),
  viewer: viewerContextSchema,
  target: commentListTargetSchema,
});

export const commentThreadResponseSchema = z.object({
  thread: z.array(commentNodeSchema),
  focusId: z.string(),
  hiddenCount: z.number().int().nonnegative(),
  viewer: viewerContextSchema,
  target: commentThreadTargetSchema,
});

export const commentUpdateResponseSchema = z.object({
  success: z.boolean(),
  comment: commentNodeSchema,
});

export const commentBatchDeleteResponseSchema = z.object({
  results: z.array(
    z.discriminatedUnion("success", [
      z.object({ success: z.literal(true), id: z.string() }),
      z.object({
        success: z.literal(false),
        id: z.string(),
        error: z.object({
          code: z.enum(["not_found", "forbidden", "locked"]),
          message: z.string(),
        }),
      }),
    ]),
  ),
});
