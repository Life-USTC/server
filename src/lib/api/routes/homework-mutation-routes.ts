import { handleRouteError, parseRouteJsonBody } from "@/lib/api/helpers";
import {
  createHomeworkAction,
  deleteHomeworkAction,
  updateHomeworkAction,
} from "@/lib/api/routes/homework-mutation-actions";
import { parseCreateHomeworkInput } from "@/lib/api/routes/homework-mutation-helpers";
import { parseHomeworkId } from "@/lib/api/routes/homework-route-helpers";
import {
  homeworkCreateRequestSchema,
  homeworkUpdateRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function postHomeworkRoute(request: Request) {
  const parsedBody = await parseRouteJsonBody(
    request,
    homeworkCreateRequestSchema,
    "Invalid homework request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const homeworkInput = parseCreateHomeworkInput(parsedBody);
  if (homeworkInput instanceof Response) return homeworkInput;

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    return await createHomeworkAction(userId, homeworkInput);
  } catch (error) {
    return handleRouteError("Failed to create homework", error);
  }
}

export async function patchHomeworkRoute(request: Request, params: IdParams) {
  const id = parseHomeworkId(params);
  if (id instanceof Response) return id;
  const parsedBody = await parseRouteJsonBody(
    request,
    homeworkUpdateRequestSchema,
    "Invalid homework update",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    return await updateHomeworkAction(id, userId, parsedBody);
  } catch (error) {
    return handleRouteError("Failed to update homework", error);
  }
}

export async function deleteHomeworkRoute(request: Request, params: IdParams) {
  const id = parseHomeworkId(params);
  if (id instanceof Response) return id;
  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    return await deleteHomeworkAction(id, userId);
  } catch (error) {
    return handleRouteError("Failed to delete homework", error);
  }
}
