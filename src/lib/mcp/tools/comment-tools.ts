import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { COMMENT_TARGET_TYPES } from "@/features/comments/lib/comment-target-types";
import {
  loadCommentThread,
  loadFocusedCommentThread,
} from "@/features/comments/server/comment-read-model";
import {
  commentListTargetPayload,
  commentThreadTargetPayload,
} from "@/features/comments/server/comment-target-payload";
import type { ResolvedCommentTarget } from "@/features/comments/server/comment-utils";
import {
  type CommentTargetType,
  resolveCommentTarget,
} from "@/features/comments/server/comment-utils";
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

type CommentsTargetInput = z.infer<typeof commentsTargetInputSchema>;

type ResolvedMcpCommentTarget =
  | {
      ok: true;
      target: ResolvedCommentTarget;
      targetType: CommentTargetType;
    }
  | {
      ok: false;
      error: "invalid_target" | "target_not_found";
      message: string;
      hint: string;
    };

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
      const resolved = await resolveMcpCommentTarget(args);
      if (!resolved.ok) {
        return jsonToolResult(
          {
            success: false,
            found: false,
            error: resolved.error,
            message: resolved.message,
            hint: resolved.hint,
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
          target: commentListTargetPayload(
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
}

async function resolveMcpCommentTarget(
  input: CommentsTargetInput,
): Promise<ResolvedMcpCommentTarget> {
  if (input.targetType === "section" && input.sectionJwId) {
    const section = await prisma.section.findUnique({
      where: { jwId: input.sectionJwId },
      select: { id: true },
    });
    if (!section) return targetNotFound("section", input.sectionJwId);
    return resolveVerifiedTarget("section", section.id);
  }

  if (input.targetType === "course" && input.courseJwId) {
    const course = await prisma.course.findUnique({
      where: { jwId: input.courseJwId },
      select: { id: true },
    });
    if (!course) return targetNotFound("course", input.courseJwId);
    return resolveVerifiedTarget("course", course.id);
  }

  if (input.targetType === "teacher") {
    return resolveVerifiedTarget("teacher", input.teacherId ?? input.targetId);
  }

  if (input.targetType === "homework") {
    return resolveVerifiedTarget(
      "homework",
      input.homeworkId ?? input.targetId,
    );
  }

  if (input.targetType === "section-teacher") {
    const directId = input.sectionTeacherId ?? input.targetId;
    if (directId) {
      return resolveVerifiedTarget("section-teacher", directId);
    }

    if (input.sectionJwId && input.teacherId) {
      const section = await prisma.section.findUnique({
        where: { jwId: input.sectionJwId },
        select: { id: true },
      });
      if (!section) return targetNotFound("section", input.sectionJwId);

      const target = await resolveCommentTarget({
        rawTargetId: undefined,
        sectionId: section.id,
        targetType: "section-teacher",
        teacherId: input.teacherId,
        verifyExistence: true,
      });
      if (!target?.verified) {
        return targetNotFound("section-teacher", input.sectionJwId);
      }
      return { ok: true, target, targetType: "section-teacher" };
    }
  }

  return resolveVerifiedTarget(input.targetType, input.targetId);
}

async function resolveVerifiedTarget(
  targetType: CommentTargetType,
  rawTargetId: unknown,
): Promise<ResolvedMcpCommentTarget> {
  const target = await resolveCommentTarget({
    allowDirectSectionTeacherId: true,
    rawTargetId,
    targetType,
    verifyExistence: true,
  });

  if (!target) {
    return invalidTarget(targetType);
  }
  if (!target.verified) {
    return targetNotFound(targetType, rawTargetId);
  }

  return { ok: true, target, targetType };
}

function invalidTarget(
  targetType: CommentTargetType,
): ResolvedMcpCommentTarget {
  return {
    ok: false,
    error: "invalid_target",
    message: `Missing or invalid ${targetType} comment target`,
    hint: "Provide targetId for the REST-compatible internal id, or a public identifier such as sectionJwId, courseJwId, teacherId, homeworkId, or sectionTeacherId.",
  };
}

function targetNotFound(
  targetType: string,
  targetId: unknown,
): ResolvedMcpCommentTarget {
  return {
    ok: false,
    error: "target_not_found",
    message: `Comment target ${targetType}:${String(targetId)} was not found`,
    hint: "Use search_sections, search_courses, search_teachers, or get_section_by_jw_id to find a valid comment target.",
  };
}
