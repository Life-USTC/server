import { loadCommentReplies } from "@/features/comments/server/comment-read-model";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteInput,
  parseRouteQuery,
} from "@/lib/api/helpers";
import {
  commentRepliesQuerySchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { resolveOptionalApiUserId } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function getCommentRepliesRoute(
  request: Request,
  params: IdParams,
) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (parsedParams instanceof Response) return parsedParams;

  const parsed = parseRouteQuery(
    new URL(request.url).searchParams,
    commentRepliesQuerySchema,
    "Invalid reply pagination",
    { pagination: { defaultPageSize: 20, maxPageSize: 20 } },
  );
  if (parsed instanceof Response) return parsed;

  try {
    const viewerUserId = await resolveOptionalApiUserId(request, {
      feature: "community.comment",
      action: "read",
    });
    if (viewerUserId instanceof Response) return viewerUserId;
    const result = await loadCommentReplies({
      commentId: parsedParams.id,
      cursor: parsed.query.cursor,
      pageSize: parsed.pagination.pageSize,
      viewerUserId,
    });
    if (!result.ok && result.error === "not_found") return notFound();
    if (!result.ok && result.error === "forbidden") return forbidden();
    if (!result.ok) return badRequest("Invalid reply cursor");

    return jsonResponse({
      nextCursor: result.nextCursor,
      rootId: result.rootId,
      thread: result.thread,
      viewer: result.viewer,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comment replies", error);
  }
}
