import {
  handleRouteError,
  parseRouteInput,
  unauthorized,
} from "@/lib/api/helpers";
import { deleteOwnCommentAction } from "@/lib/api/routes/comment-delete-action";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

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
    const userId = await resolveApiUserId(request);
    if (!userId) {
      return unauthorized();
    }

    return await deleteOwnCommentAction({
      commentId: id,
      request,
      userId,
    });
  } catch (error) {
    return handleRouteError("Failed to delete comment", error);
  }
}
