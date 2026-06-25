import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { COMMENT_TARGET_TYPES } from "@/features/comments/lib/comment-target-types";
import {
  writeCommentCreateAuditLog,
  writeCommentDeleteAuditLog,
  writeCommentEditAuditLog,
  writeCommentReactionAuditLog,
} from "@/features/comments/server/comment-audit";
import {
  createComment,
  createCommentReaction,
  deleteCommentReaction,
  deleteOwnComment,
  updateOwnComment,
} from "@/features/comments/server/comment-mutations";
import {
  loadCommentThread,
  loadFocusedCommentThread,
} from "@/features/comments/server/comment-read-model";
import {
  commentListTargetPayload,
  commentThreadTargetPayload,
} from "@/features/comments/server/comment-target-payload";
import {
  type ResolvedCommentTargetReference,
  resolveCommentTargetReference,
} from "@/features/comments/server/comment-target-resolution";
import {
  commentCreateRequestSchema,
  commentReactionRequestSchema,
  commentUpdateRequestSchema,
} from "@/lib/api/schemas/request-comment-mutation-schemas";
import { prisma } from "@/lib/db/prisma";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

const commentTargetIdSchema = z.union([
  z.number().int().positive(),
  z.string().trim().min(1),
]);

const commentsTargetInputSchema = z.object({
  targetType: z.enum(COMMENT_TARGET_TYPES),
  targetId: commentTargetIdSchema
    .optional()
    .describe(
      "Internal target id matching REST /api/comments. Prefer public identifiers such as sectionJwId or courseJwId when available.",
    ),
  sectionJwId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Public JW section id for section or section-teacher comments."),
  courseJwId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Public JW course id for course comments."),
  teacherId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Teacher id for teacher or section-teacher comments."),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Direct section-teacher relationship id."),
  mode: mcpModeInputSchema,
});

const commentThreadInputSchema = z.object({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

const commentCreateInputSchema = commentCreateRequestSchema.extend({
  targetId: commentTargetIdSchema
    .optional()
    .describe(
      "Internal target id matching REST /api/comments. Prefer public identifiers such as sectionJwId or courseJwId when available.",
    ),
  sectionId: commentTargetIdSchema
    .optional()
    .describe("Internal section id for section-teacher comments."),
  teacherId: commentTargetIdSchema
    .optional()
    .describe("Teacher id for teacher or section-teacher comments."),
  sectionJwId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Public JW section id for section or section-teacher comments."),
  courseJwId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Public JW course id for course comments."),
  homeworkId: z.string().trim().min(1).optional(),
  sectionTeacherId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Direct section-teacher relationship id."),
  mode: mcpModeInputSchema,
});

const commentUpdateInputSchema = commentUpdateRequestSchema.extend({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

const commentDeleteInputSchema = z.object({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

const commentReactionInputSchema = commentReactionRequestSchema.extend({
  commentId: z.string().trim().min(1),
  mode: mcpModeInputSchema,
});

type CommentCreateInput = z.infer<typeof commentCreateInputSchema>;
type ResolvedCommentMutationTarget =
  | {
      ok: true;
      rawTargetId: unknown;
      sectionId?: unknown;
      teacherId?: unknown;
    }
  | Extract<ResolvedCommentTargetReference, { ok: false }>;

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
    async (args, extra) => {
      const mode = resolveMcpMode(args.mode);
      const target = await resolveCommentMutationTarget(args);
      if (!target.ok) {
        return jsonToolResult(
          {
            success: false,
            found: false,
            ...unresolvedCommentTargetPayload(target),
          },
          { mode },
        );
      }

      const userId = getUserId(extra.authInfo);
      const result = await createComment({
        attachmentIds: args.attachmentIds,
        content: args.body,
        isAnonymous: args.isAnonymous === true,
        parentId: args.parentId,
        rawTargetId: target.rawTargetId,
        sectionId: target.sectionId,
        targetType: args.targetType,
        teacherId: target.teacherId,
        userId,
        visibility: args.visibility ?? "public",
      });

      if (!result.ok) {
        return jsonToolResult(commentMutationErrorPayload(result), { mode });
      }

      writeCommentCreateAuditLog({
        auditMetadata: { source: "mcp" },
        body: args.body,
        commentId: result.comment.id,
        userId,
      });

      return jsonToolResult({ success: true, id: result.comment.id }, { mode });
    },
  );

  server.registerTool(
    "update_own_comment",
    {
      description:
        "Update the authenticated user's own active comment. Mirrors PATCH /api/comments/[id] and returns the updated comment snapshot.",
      inputSchema: commentUpdateInputSchema.shape,
    },
    async (args, extra) => {
      const mode = resolveMcpMode(args.mode);
      const userId = getUserId(extra.authInfo);
      const hasAttachmentUpdate = Array.isArray(args.attachmentIds);
      const result = await updateOwnComment({
        attachmentIds: hasAttachmentUpdate ? (args.attachmentIds ?? []) : [],
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

      writeCommentEditAuditLog({
        auditMetadata: { source: "mcp" },
        body: args.body,
        commentId: args.commentId,
        userId,
      });

      return jsonToolResult(
        { success: true, comment: result.comment },
        { mode },
      );
    },
  );

  server.registerTool(
    "delete_own_comment",
    {
      description:
        "Delete the authenticated user's own comment. Only the owner can use this ordinary-user delete action.",
      inputSchema: commentDeleteInputSchema.shape,
    },
    async ({ commentId, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const result = await deleteOwnComment({ commentId, userId });

      if (!result.ok) {
        return jsonToolResult(commentMutationErrorPayload(result), {
          mode: resolvedMode,
        });
      }

      writeCommentDeleteAuditLog({
        auditMetadata: { source: "mcp" },
        commentId,
        userId,
      });

      return jsonToolResult({ success: true }, { mode: resolvedMode });
    },
  );

  server.registerTool(
    "add_comment_reaction",
    {
      description:
        "Add a reaction to a visible active comment. Returns whether a new reaction row was created.",
      inputSchema: commentReactionInputSchema.shape,
    },
    async ({ commentId, mode, type }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const result = await createCommentReaction({ commentId, type, userId });

      if (!result.ok) {
        return jsonToolResult(commentMutationErrorPayload(result), {
          mode: resolvedMode,
        });
      }

      if (result.changed) {
        writeCommentReactionAuditLog({
          auditMetadata: { source: "mcp" },
          commentId,
          operation: "add",
          type,
          userId,
        });
      }

      return jsonToolResult(
        { success: true, changed: result.changed },
        { mode: resolvedMode },
      );
    },
  );

  server.registerTool(
    "remove_comment_reaction",
    {
      description:
        "Remove the authenticated user's reaction from a comment. Returns whether a reaction row was removed.",
      inputSchema: commentReactionInputSchema.shape,
    },
    async ({ commentId, mode, type }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const result = await deleteCommentReaction({ commentId, type, userId });

      if (!result.ok) {
        return jsonToolResult(commentMutationErrorPayload(result), {
          mode: resolvedMode,
        });
      }

      if (result.changed) {
        writeCommentReactionAuditLog({
          auditMetadata: { source: "mcp" },
          commentId,
          operation: "remove",
          type,
          userId,
        });
      }

      return jsonToolResult(
        { success: true, changed: result.changed },
        { mode: resolvedMode },
      );
    },
  );
}

async function resolveCommentMutationTarget(
  input: CommentCreateInput,
): Promise<ResolvedCommentMutationTarget> {
  const resolved = await resolveCommentTargetReference({
    allowDirectSectionTeacherId: true,
    courseJwId: input.courseJwId,
    homeworkId: input.homeworkId,
    rawTargetId: input.targetId,
    sectionId: input.sectionId,
    sectionJwId: input.sectionJwId,
    sectionTeacherId: input.sectionTeacherId,
    targetType: input.targetType,
    teacherId: input.teacherId,
    verifyExistence: true,
  });

  if (!resolved.ok) return resolved;
  if (input.targetType !== "section-teacher") {
    return { ok: true, rawTargetId: resolved.target.targetId };
  }

  if (resolved.target.sectionId && resolved.target.teacherId) {
    return {
      ok: true,
      rawTargetId: undefined,
      sectionId: resolved.target.sectionId,
      teacherId: resolved.target.teacherId,
    };
  }

  if (resolved.target.sectionTeacherId) {
    const sectionTeacher = await prisma.sectionTeacher.findFirst({
      where: { id: resolved.target.sectionTeacherId, retiredAt: null },
      select: { sectionId: true, teacherId: true },
    });
    if (sectionTeacher) {
      return {
        ok: true,
        rawTargetId: undefined,
        sectionId: sectionTeacher.sectionId,
        teacherId: sectionTeacher.teacherId,
      };
    }
    return {
      ok: false,
      error: "target_not_found",
      targetId: resolved.target.sectionTeacherId,
      targetType: "section-teacher",
    };
  }

  return {
    ok: false,
    error: "invalid_target",
    targetId: undefined,
    targetType: "section-teacher",
  };
}

function unresolvedCommentTargetPayload(
  result: Extract<ResolvedCommentTargetReference, { ok: false }>,
) {
  if (result.error === "target_not_found") {
    return targetNotFound(result.targetType, result.targetId);
  }
  return {
    error: "invalid_target",
    message: `Missing or invalid ${result.targetType} comment target`,
    hint: "Provide targetId for the REST-compatible internal id, or a public identifier such as sectionJwId, courseJwId, teacherId, homeworkId, or sectionTeacherId.",
  };
}

function commentMutationErrorPayload(result: {
  error: string;
  reason?: string | null;
}) {
  if (result.error === "suspended") {
    return {
      success: false,
      error: "suspended",
      message: "Suspended",
      reason: result.reason ?? null,
    };
  }

  if (result.error === "not_found") {
    return {
      success: false,
      found: false,
      error: "not_found",
      message: "Comment not found",
    };
  }

  if (result.error === "target_not_found") {
    return {
      success: false,
      found: false,
      error: "target_not_found",
      message: "Target not found",
    };
  }

  if (result.error === "parent_not_found") {
    return {
      success: false,
      found: false,
      error: "parent_not_found",
      message: "Parent not found",
    };
  }

  if (result.error === "target_mismatch") {
    return {
      success: false,
      error: "target_mismatch",
      message: "Parent target mismatch",
    };
  }

  if (result.error === "invalid_attachments") {
    return {
      success: false,
      error: "invalid_attachments",
      message: "Invalid attachments",
    };
  }

  if (result.error === "invalid_target") {
    return {
      success: false,
      found: false,
      error: "invalid_target",
      message: "Invalid target",
    };
  }

  if (result.error === "locked") {
    return {
      success: false,
      error: "locked",
      message: "Comment locked",
    };
  }

  return {
    success: false,
    error: "forbidden",
    message: "Forbidden",
  };
}

function targetNotFound(
  targetType: string,
  targetId: unknown,
): {
  error: "target_not_found";
  message: string;
  hint: string;
} {
  return {
    error: "target_not_found",
    message: `Comment target ${targetType}:${String(targetId)} was not found`,
    hint: "Use search_sections, search_courses, search_teachers, or get_section_by_jw_id to find a valid comment target.",
  };
}
