import { createComment } from "@/features/comments/server/comment-mutations";
import {
  badRequest,
  createdJsonResponse,
  forbidden,
  handleRouteError,
  notFound,
  parseRouteJsonBody,
  suspensionForbidden,
} from "@/lib/api/helpers";
import { commentCreateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/api-auth";

export async function postCommentRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "comment", action: "write" },
  });
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    commentCreateRequestSchema,
    "Invalid comment request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const targetType = parsedBody.targetType;
  const content = parsedBody.body;
  const visibility = parsedBody.visibility ?? "public";
  const isAnonymous = parsedBody.isAnonymous === true;

  try {
    const result = await createComment({
      attachmentIds: parsedBody.attachmentIds,
      auditMetadata: getAuditRequestMetadata(request),
      content,
      courseJwId: parsedBody.courseJwId,
      homeworkId: parsedBody.homeworkId,
      isAnonymous,
      parentId: parsedBody.parentId,
      rawTargetId: parsedBody.targetId,
      sectionId: parsedBody.sectionId,
      sectionJwId: parsedBody.sectionJwId,
      sectionTeacherId: parsedBody.sectionTeacherId,
      targetType,
      teacherId: parsedBody.teacherId,
      userId,
      visibility,
    });
    if (!result.ok) {
      if (result.error === "invalid_target") {
        return badRequest("Invalid target");
      }
      if (result.error === "target_not_found") {
        return notFound("Target not found");
      }
      if (result.error === "parent_not_found") {
        return notFound("Parent not found");
      }
      if (result.error === "target_mismatch") {
        return badRequest("Parent target mismatch");
      }
      if (result.error === "invalid_attachments") {
        return badRequest("Invalid attachments");
      }
      if (result.error === "suspended") {
        return suspensionForbidden("reason" in result ? result.reason : null);
      }
      return forbidden();
    }

    return createdJsonResponse(
      { id: result.comment.id },
      `/api/comments/${encodeURIComponent(result.comment.id)}`,
    );
  } catch (error) {
    return handleRouteError("Failed to create comment", error);
  }
}
