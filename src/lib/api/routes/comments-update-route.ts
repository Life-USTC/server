import {
  handleRouteError,
  parseRouteInput,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { updateCommentAction } from "@/lib/api/routes/comments-update-action";
import {
  commentUpdateRequestSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function patchCommentRoute(
  request: Request,
  params: IdParams,
): Promise<Response> {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }

  const auth = await requireAuth(request, {
    bearerScope: { feature: "comment", action: "write" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    commentUpdateRequestSchema,
    "Invalid comment update",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  try {
    const response = await updateCommentAction(
      request,
      parsedParams.id,
      parsedBody,
      userId,
    );
    return (
      response ??
      handleRouteError(
        "Failed to update comment",
        new Error("updateCommentAction returned no response"),
      )
    );
  } catch (error) {
    return handleRouteError("Failed to update comment", error);
  }
}
