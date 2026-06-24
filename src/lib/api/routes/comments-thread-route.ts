import { loadFocusedCommentThread } from "@/features/comments/server/comment-read-model";
import { commentThreadTargetPayload } from "@/features/comments/server/comment-target-payload";
import {
  forbidden,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteInput,
} from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function getCommentRoute(request: Request, params: IdParams) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  const id = parsedParams.id;

  try {
    const viewerUserId = await resolveApiUserId(request);
    const result = await loadFocusedCommentThread({
      commentId: id,
      viewerUserId,
    });

    if (!result.ok && result.error === "not_found") {
      return notFound();
    }
    if (!result.ok) {
      return forbidden();
    }

    return jsonResponse({
      thread: result.thread,
      focusId: result.focusId,
      hiddenCount: result.hiddenCount,
      viewer: result.viewer,
      target: commentThreadTargetPayload(result.target),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comment", error);
  }
}
