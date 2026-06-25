import type { ResolvedCommentTargetReference } from "@/features/comments/server/comment-target-resolution";

export function unresolvedCommentTargetPayload(
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

export function commentMutationErrorPayload(result: {
  error: string;
  reason?: string | null;
  targetId?: unknown;
  targetType?: string;
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
      message: result.targetType
        ? `Comment target ${result.targetType}:${String(result.targetId)} was not found`
        : "Target not found",
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
      message: result.targetType
        ? `Missing or invalid ${result.targetType} comment target`
        : "Invalid target",
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
