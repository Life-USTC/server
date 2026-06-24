import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import { commentListTargetPayload } from "@/features/comments/server/comment-target-payload";
import { resolveCommentTarget } from "@/features/comments/server/comment-utils";
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
    const target = await resolveCommentTarget({
      allowDirectSectionTeacherId: true,
      rawTargetId: targetIdParam,
      sectionId: parsedQuery.sectionId,
      targetType,
      teacherId: parsedQuery.teacherId,
      verifyExistence: true,
    });
    if (!target) {
      return badRequest("Invalid target");
    }
    if (!target.verified) {
      return notFound();
    }

    const viewerUserId = await resolveApiUserId(request);
    const { comments, hiddenCount, viewer } = await loadCommentThread({
      target,
      viewerUserId,
    });

    return jsonResponse({
      comments,
      hiddenCount,
      viewer,
      target: commentListTargetPayload(targetType, target),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comments", error);
  }
}
