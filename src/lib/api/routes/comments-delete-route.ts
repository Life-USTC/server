import { handleRouteError, parseRouteInput } from "@/lib/api/helpers";
import { deleteOwnCommentAction } from "@/lib/api/routes/comment-delete-action";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function deleteCommentRoute(request: Request, params: IdParams) {
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
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    return await deleteOwnCommentAction({
      commentId: id,
      request,
      userId: auth.userId,
    });
  } catch (error) {
    return handleRouteError("Failed to delete comment", error);
  }
}
