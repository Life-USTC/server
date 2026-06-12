import {
  handleRouteError,
  parseRouteInput,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { updateHomeworkCompletionAction } from "@/lib/api/routes/homework-completion-action";
import {
  homeworkCompletionRequestSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function putHomeworkCompletionRoute(
  request: Request,
  params: IdParams,
) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid homework ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  const id = parsedParams.id;
  const parsedBody = await parseRouteJsonBody(
    request,
    homeworkCompletionRequestSchema,
    "Invalid completion payload",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    return await updateHomeworkCompletionAction({
      completed: parsedBody.completed,
      homeworkId: id,
      userId,
    });
  } catch (error) {
    return handleRouteError("Failed to update completion", error);
  }
}
