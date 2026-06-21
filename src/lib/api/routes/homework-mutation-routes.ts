import {
  createHomeworkForSection,
  resolveSectionIdForHomeworkCreate,
} from "@/features/homeworks/server/homework-create";
import { requireHomeworkItemById } from "@/features/homeworks/server/homework-read-model";
import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import {
  deleteHomeworkAction,
  updateHomeworkAction,
} from "@/lib/api/routes/homework-mutation-actions";
import { parseCreateHomeworkInput } from "@/lib/api/routes/homework-mutation-helpers";
import { parseHomeworkId } from "@/lib/api/routes/homework-route-helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import {
  homeworkCreateRequestSchema,
  homeworkUpdateRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function postHomeworkRoute(request: Request) {
  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

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

  try {
    const sectionId = await resolveSectionIdForHomeworkCreate(homeworkInput);
    if (!sectionId) return notFound("Section not found");

    const homework = await createHomeworkForSection(userId, {
      ...homeworkInput,
      sectionId,
    });
    if (!homework) return notFound("Section not found");
    const homeworkItem = await requireHomeworkItemById({
      homeworkId: homework.id,
      locale: getRequestLocale(request),
      userId,
    });
    return jsonResponse({ id: homework.id, homework: homeworkItem });
  } catch (error) {
    return handleRouteError("Failed to create homework", error);
  }
}

export async function patchHomeworkRoute(request: Request, params: IdParams) {
  const id = parseHomeworkId(params);
  if (id instanceof Response) return id;

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    homeworkUpdateRequestSchema,
    "Invalid homework update",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

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
