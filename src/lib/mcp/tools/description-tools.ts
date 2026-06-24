import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  DESCRIPTION_TARGET_TYPES,
  type DescriptionTargetType,
  type ResolvedDescriptionTargetReference,
  resolveDescriptionTargetReference,
} from "@/features/descriptions/server/description-targets";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { getResolvedDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import { getViewerContext } from "@/lib/auth/viewer-context";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

const descriptionTargetIdSchema = z.union([
  z.number().int().positive(),
  z.string().trim().min(1),
]);

const descriptionTargetInputSchema = z.object({
  targetType: z.enum(DESCRIPTION_TARGET_TYPES),
  targetId: descriptionTargetIdSchema
    .optional()
    .describe(
      "Internal target id matching REST /api/descriptions. Prefer public identifiers such as sectionJwId or courseJwId when available.",
    ),
  sectionJwId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Public JW section id for section descriptions."),
  courseJwId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Public JW course id for course descriptions."),
  teacherId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Teacher id for teacher descriptions."),
  homeworkId: z.string().trim().min(1).optional(),
  mode: mcpModeInputSchema,
});

const descriptionUpsertInputSchema = descriptionTargetInputSchema.extend({
  content: z
    .string()
    .max(4000)
    .describe("Markdown description content. Matches POST /api/descriptions."),
});

type DescriptionTargetInput = z.infer<typeof descriptionTargetInputSchema>;

export function registerDescriptionTools(server: McpServer) {
  server.registerTool(
    "get_description",
    {
      description:
        "Read the Markdown description, edit history, and viewer state for one section, course, teacher, or homework target. " +
        "Returns the same description/history/viewer payload as REST /api/descriptions.",
      inputSchema: descriptionTargetInputSchema.shape,
    },
    async (args, extra) => {
      const mode = resolveMcpMode(args.mode);
      const resolved = await resolveDescriptionTargetForTool(args, true);
      if (!resolved.ok) {
        return jsonToolResult(unresolvedDescriptionTargetPayload(resolved), {
          mode,
        });
      }

      const userId = getUserId(extra.authInfo);
      const viewer = await getViewerContext({ userId });
      const payload = await getResolvedDescriptionPayload(
        resolved.target,
        viewer,
      );

      return jsonToolResult(
        {
          found: true,
          target: descriptionTargetPayload(resolved),
          ...payload,
        },
        { mode },
      );
    },
  );

  server.registerTool(
    "upsert_description",
    {
      description:
        "Create or replace the Markdown description for one section, course, teacher, or homework target. " +
        "Requires an authenticated, unsuspended user and returns the updated description payload.",
      inputSchema: descriptionUpsertInputSchema.shape,
    },
    async (args, extra) => {
      const mode = resolveMcpMode(args.mode);
      const resolved = await resolveDescriptionTargetForTool(args, true);
      if (!resolved.ok) {
        return jsonToolResult(unresolvedDescriptionTargetPayload(resolved), {
          mode,
        });
      }

      const userId = getUserId(extra.authInfo);
      const targetType = resolved.targetType;
      const content = args.content.trim();
      const result = await upsertDescriptionContent({
        auditMetadata: { source: "mcp" },
        content,
        targetId: resolved.targetId,
        targetType,
        userId,
      });

      if (!result.ok) {
        return jsonToolResult(descriptionUpsertErrorPayload(result), { mode });
      }

      const viewer = await getViewerContext({ userId });
      const payload = await getResolvedDescriptionPayload(
        resolved.target,
        viewer,
      );

      return jsonToolResult(
        {
          success: true,
          id: result.id,
          updated: result.updated,
          target: descriptionTargetPayload(resolved),
          ...payload,
        },
        { mode },
      );
    },
  );
}

async function resolveDescriptionTargetForTool(
  input: DescriptionTargetInput,
  verifyExistence: boolean,
) {
  return resolveDescriptionTargetReference({
    courseJwId: input.courseJwId,
    homeworkId: input.homeworkId,
    rawTargetId: input.targetId,
    sectionJwId: input.sectionJwId,
    targetType: input.targetType,
    teacherId: input.teacherId,
    verifyExistence,
  });
}

function descriptionTargetPayload(
  resolved: Extract<ResolvedDescriptionTargetReference, { ok: true }>,
) {
  return {
    type: resolved.targetType,
    targetId: resolved.targetId,
  };
}

function unresolvedDescriptionTargetPayload(
  result: Extract<ResolvedDescriptionTargetReference, { ok: false }>,
) {
  if (result.error === "target_not_found") {
    return {
      success: false,
      found: false,
      error: "target_not_found",
      message: `Description target ${result.targetType}:${String(result.targetId)} was not found`,
      hint: descriptionTargetHint(result.targetType),
    };
  }

  return {
    success: false,
    found: false,
    error: "invalid_target",
    message: `Missing or invalid ${result.targetType} description target`,
    hint: descriptionTargetHint(result.targetType),
  };
}

function descriptionTargetHint(targetType: DescriptionTargetType | string) {
  if (targetType === "section") {
    return "Provide sectionJwId, or use search_sections/get_section_by_jw_id to find a valid section.";
  }
  if (targetType === "course") {
    return "Provide courseJwId, or use search_courses/get_course_by_jw_id to find a valid course.";
  }
  if (targetType === "teacher") {
    return "Provide teacherId, or use search_teachers/get_teacher_by_id to find a valid teacher.";
  }
  if (targetType === "homework") {
    return "Provide homeworkId, or use list_homeworks_by_section/list_my_homeworks to find a valid homework.";
  }
  return "Provide targetId for the REST-compatible internal id, or a public identifier such as sectionJwId, courseJwId, teacherId, or homeworkId.";
}

function descriptionUpsertErrorPayload(
  result: Exclude<
    Awaited<ReturnType<typeof upsertDescriptionContent>>,
    { ok: true }
  >,
) {
  if (result.error === "suspended") {
    return {
      success: false,
      error: "suspended",
      message: "Suspended",
      reason: "reason" in result ? (result.reason ?? null) : null,
    };
  }

  if (result.error === "not_found") {
    return {
      success: false,
      found: false,
      error: "target_not_found",
      message: "Description target was not found",
    };
  }

  if (result.error === "invalid_target") {
    return {
      success: false,
      found: false,
      error: "invalid_target",
      message: "Missing or invalid description target",
    };
  }

  return {
    success: false,
    error: "forbidden",
    message: "Forbidden",
  };
}
