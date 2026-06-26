import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { commentMcpTargetReadInputSchema } from "@/features/comments/lib/comment-target-input-schemas";
import {
  loadCommentThread,
  loadFocusedCommentThread,
} from "@/features/comments/server/comment-read-model";
import {
  commentListTargetPayload,
  commentThreadTargetPayload,
} from "@/features/comments/server/comment-target-payload";
import { resolveCommentTargetReference } from "@/features/comments/server/comment-target-resolution";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { unresolvedCommentTargetPayload } from "./comment-tool-errors";
import {
  addCommentReactionTool,
  commentCreateInputSchema,
  commentDeleteInputSchema,
  commentReactionInputSchema,
  commentUpdateInputSchema,
  createCommentTool,
  deleteOwnCommentTool,
  removeCommentReactionTool,
  updateOwnCommentTool,
} from "./comment-write-tool-handlers";

const commentsTargetInputSchema = commentMcpTargetReadInputSchema.extend({
  mode: mcpModeInputSchema,
});

const commentThreadInputSchema = z.object({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

export function registerCommentTools(server: McpServer) {
  server.registerTool(
    "list_comments",
    {
      description:
        "List visible comments for one course, section, teacher, homework, or section-teacher target. " +
        "Returns the same threaded comment nodes, hidden count, viewer state, reactions, attachments, and action flags as the REST comment list.",
      inputSchema: commentsTargetInputSchema.shape,
    },
    async (args, extra) => {
      const mode = resolveMcpMode(args.mode);
      const resolved = await resolveCommentTargetReference({
        allowDirectSectionTeacherId: true,
        courseJwId: args.courseJwId,
        homeworkId: args.homeworkId,
        rawTargetId: args.targetId,
        sectionJwId: args.sectionJwId,
        sectionTeacherId: args.sectionTeacherId,
        targetType: args.targetType,
        teacherId: args.teacherId,
        verifyExistence: true,
      });
      if (!resolved.ok) {
        const errorPayload = unresolvedCommentTargetPayload(resolved);
        return jsonToolResult(
          {
            success: false,
            found: false,
            error: errorPayload.error,
            message: errorPayload.message,
            hint: errorPayload.hint,
          },
          { mode },
        );
      }

      const viewerUserId = getUserId(extra.authInfo);
      const { comments, hiddenCount, viewer } = await loadCommentThread({
        target: resolved.target,
        viewerUserId,
      });

      return jsonToolResult(
        {
          found: true,
          comments,
          hiddenCount,
          viewer,
          target: await commentListTargetPayload(
            resolved.targetType,
            resolved.target,
          ),
        },
        { mode },
      );
    },
  );

  server.registerTool(
    "get_comment_thread",
    {
      description:
        "Fetch the visible thread around one comment id. Returns the same focus id, target payload, viewer state, and threaded comment nodes as REST /api/comments/[id].",
      inputSchema: commentThreadInputSchema.shape,
    },
    async ({ commentId, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const viewerUserId = getUserId(extra.authInfo);
      const result = await loadFocusedCommentThread({
        commentId,
        viewerUserId,
      });

      if (!result.ok) {
        return jsonToolResult(
          {
            success: false,
            found: result.error !== "not_found",
            error: result.error,
            message:
              result.error === "not_found"
                ? `Comment ${commentId} was not found`
                : `Comment ${commentId} is not visible to the current viewer`,
          },
          { mode: resolvedMode },
        );
      }

      return jsonToolResult(
        {
          found: true,
          thread: result.thread,
          focusId: result.focusId,
          hiddenCount: result.hiddenCount,
          viewer: result.viewer,
          target: commentThreadTargetPayload(result.target),
        },
        { mode: resolvedMode },
      );
    },
  );

  server.registerTool(
    "create_comment",
    {
      description:
        "Create a comment or reply on one course, section, teacher, homework, or section-teacher target. " +
        "Requires the authenticated user to be unsuspended and returns the new comment id.",
      inputSchema: commentCreateInputSchema.shape,
    },
    createCommentTool,
  );

  server.registerTool(
    "update_own_comment",
    {
      description:
        "Update the authenticated user's own active comment. Mirrors PATCH /api/comments/[id] and returns the updated comment snapshot.",
      inputSchema: commentUpdateInputSchema.shape,
    },
    updateOwnCommentTool,
  );

  server.registerTool(
    "delete_own_comment",
    {
      description:
        "Delete the authenticated user's own comment. Only the owner can use this ordinary-user delete action.",
      inputSchema: commentDeleteInputSchema.shape,
    },
    deleteOwnCommentTool,
  );

  server.registerTool(
    "add_comment_reaction",
    {
      description:
        "Add a reaction to a visible active comment. Returns whether a new reaction row was created.",
      inputSchema: commentReactionInputSchema.shape,
    },
    addCommentReactionTool,
  );

  server.registerTool(
    "remove_comment_reaction",
    {
      description:
        "Remove the authenticated user's reaction from a comment. Returns whether a reaction row was removed.",
      inputSchema: commentReactionInputSchema.shape,
    },
    removeCommentReactionTool,
  );
}
