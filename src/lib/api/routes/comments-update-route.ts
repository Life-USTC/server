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
