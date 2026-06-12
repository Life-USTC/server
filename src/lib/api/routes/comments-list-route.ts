import { resolveCommentTarget } from "@/features/comments/server/comment-utils";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  commentListTargetPayload,
  loadCommentThread,
} from "@/lib/api/routes/comments-list-response";
import { commentsQuerySchema } from "@/lib/api/schemas/request-schemas";

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
    });
    if (!target) {
      return badRequest("Invalid target");
    }

    const { comments, hiddenCount, viewer } = await loadCommentThread({
      request,
      target,
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
