import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import { commentListTargetPayload } from "@/features/comments/server/comment-target-payload";
import { resolveCommentTargetReference } from "@/features/comments/server/comment-target-resolution";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { commentsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

export async function getCommentsRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    commentsQuerySchema,
    "Invalid target",
  );
  if (parsedQuery instanceof Response) {
    return badRequest("Invalid target");
  }

  const targetType = parsedQuery.targetType;
  const targetIdParam = parsedQuery.targetId ?? null;

  try {
    const resolved = await resolveCommentTargetReference({
      allowDirectSectionTeacherId: true,
      courseJwId: parsedQuery.courseJwId,
      homeworkId: parsedQuery.homeworkId,
      rawTargetId: targetIdParam,
      sectionId: parsedQuery.sectionId,
      sectionJwId: parsedQuery.sectionJwId,
      sectionTeacherId: parsedQuery.sectionTeacherId,
      targetType,
      teacherId: parsedQuery.teacherId,
      verifyExistence: true,
    });
    if (!resolved.ok && resolved.error === "invalid_target") {
      return badRequest("Invalid target");
    }
    if (!resolved.ok) {
      return notFound();
    }

    const viewerUserId = await resolveApiUserId(request);
    const { comments, hiddenCount, viewer } = await loadCommentThread({
      target: resolved.target,
      viewerUserId,
    });

    return jsonResponse({
      comments,
      hiddenCount,
      viewer,
      target: await commentListTargetPayload(targetType, resolved.target),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comments", error);
  }
}
