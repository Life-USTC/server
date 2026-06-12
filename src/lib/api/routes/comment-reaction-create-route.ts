import {
  handleRouteError,
  parseRouteInput,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { createCommentReactionAction } from "@/lib/api/routes/comment-reaction-actions";
import {
  commentReactionRequestSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function postCommentReactionRoute(
  request: Request,
  params: IdParams,
) {
  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  const id = parsedParams.id;
  const parsedBody = await parseRouteJsonBody(
    request,
    commentReactionRequestSchema,
    "Invalid reaction",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }
  const type = parsedBody.type;

  try {
    return await createCommentReactionAction({
      commentId: id,
      type,
      userId,
    });
  } catch (error) {
    return handleRouteError("Failed to add reaction", error);
  }
}
