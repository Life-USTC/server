import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import * as z from "zod";
import { commentMcpTargetMutationInputSchema } from "@/features/comments/lib/comment-target-input-schemas";
import {
  createComment,
  createCommentReaction,
  deleteCommentReaction,
  deleteOwnComment,
  updateOwnComment,
} from "@/features/comments/server/comment-mutations";
import {
  commentCreateRequestSchema,
  commentReactionRequestSchema,
  commentUpdateRequestSchema,
} from "@/lib/api/schemas/request-comment-mutation-schemas";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { commentMutationErrorPayload } from "./comment-tool-errors";

export const commentCreateInputSchema = commentCreateRequestSchema.extend({
  ...commentMcpTargetMutationInputSchema.shape,
  mode: mcpModeInputSchema,
});

export const commentUpdateInputSchema = commentUpdateRequestSchema.extend({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

export const commentDeleteInputSchema = z.object({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

export const commentReactionInputSchema = commentReactionRequestSchema.extend({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

type ToolExtra = { authInfo?: AuthInfo };
type CommentCreateInput = z.infer<typeof commentCreateInputSchema>;

export async function createCommentTool(
  args: CommentCreateInput,
  extra: ToolExtra,
) {
  const mode = resolveMcpMode(args.mode);
  const userId = getUserId(extra.authInfo);
  const result = await createComment({
    attachmentIds: args.attachmentIds,
    auditMetadata: { source: "mcp" },
    content: args.body,
    courseJwId: args.courseJwId,
    homeworkId: args.homeworkId,
    isAnonymous: args.isAnonymous === true,
    parentId: args.parentId,
    rawTargetId: args.targetId,
    sectionId: args.sectionId,
    sectionJwId: args.sectionJwId,
    sectionTeacherId: args.sectionTeacherId,
    targetType: args.targetType,
    teacherId: args.teacherId,
    userId,
    visibility: args.visibility ?? "public",
  });

  if (!result.ok) {
    return jsonToolResult(commentMutationErrorPayload(result), { mode });
  }

  return jsonToolResult({ success: true, id: result.comment.id }, { mode });
}

export async function updateOwnCommentTool(
  args: z.infer<typeof commentUpdateInputSchema>,
  extra: ToolExtra,
) {
  const mode = resolveMcpMode(args.mode);
  const userId = getUserId(extra.authInfo);
  const hasAttachmentUpdate = Array.isArray(args.attachmentIds);
  const result = await updateOwnComment({
    attachmentIds: hasAttachmentUpdate ? (args.attachmentIds ?? []) : [],
    auditMetadata: { source: "mcp" },
    body: args.body,
    hasAttachmentUpdate,
    id: args.commentId,
    isAnonymous: args.isAnonymous,
    userId,
    visibility: args.visibility,
  });

  if (!result.ok) {
    return jsonToolResult(commentMutationErrorPayload(result), { mode });
  }

  return jsonToolResult({ success: true, comment: result.comment }, { mode });
}

export async function deleteOwnCommentTool(
  { commentId, mode }: z.infer<typeof commentDeleteInputSchema>,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const result = await deleteOwnComment({
    auditMetadata: { source: "mcp" },
    commentId,
    userId,
  });

  if (!result.ok) {
    return jsonToolResult(commentMutationErrorPayload(result), {
      mode: resolvedMode,
    });
  }

  return jsonToolResult({ success: true }, { mode: resolvedMode });
}

export async function addCommentReactionTool(
  { commentId, mode, type }: z.infer<typeof commentReactionInputSchema>,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const result = await createCommentReaction({
    auditMetadata: { source: "mcp" },
    commentId,
    type,
    userId,
  });

  if (!result.ok) {
    return jsonToolResult(commentMutationErrorPayload(result), {
      mode: resolvedMode,
    });
  }

  return jsonToolResult(
    { success: true, changed: result.changed },
    { mode: resolvedMode },
  );
}

export async function removeCommentReactionTool(
  { commentId, mode, type }: z.infer<typeof commentReactionInputSchema>,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const result = await deleteCommentReaction({
    auditMetadata: { source: "mcp" },
    commentId,
    type,
    userId,
  });

  if (!result.ok) {
    return jsonToolResult(commentMutationErrorPayload(result), {
      mode: resolvedMode,
    });
  }

  return jsonToolResult(
    { success: true, changed: result.changed },
    { mode: resolvedMode },
  );
}
