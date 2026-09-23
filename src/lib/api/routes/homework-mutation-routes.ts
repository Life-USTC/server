import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import { requireHomeworkItemById } from "@/features/homeworks/server/homework-read-model";
import {
  badRequest,
  createdJsonResponse,
  forbidden,
  handleRouteError,
  notFound,
  parseRouteJsonBody,
  suspensionForbidden,
} from "@/lib/api/helpers";
import { parseCreateHomeworkInput } from "@/lib/api/routes/homework-create-input";
import { deleteHomeworkAction } from "@/lib/api/routes/homework-delete-action";
import { parseHomeworkId } from "@/lib/api/routes/homework-route-helpers";
import { updateHomeworkAction } from "@/lib/api/routes/homework-update-action";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import {
  homeworkCreateRequestSchema,
  homeworkUpdateRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import { attributionFromApiPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import { requireAuthPrincipal } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function postHomeworkRoute(request: Request) {
  const auth = await requireAuthPrincipal(request, {
    bearerScope: { feature: "community.section-homework", action: "write" },
  });
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;
  const audit = {
    ...attributionFromApiPrincipal(auth),
    requestId: getAuditRequestMetadata(request).requestId,
  };

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
    const result = await createHomeworkForSection(userId, homeworkInput, audit);
    if (!result.ok) {
      if (result.error === "mismatch") return badRequest("Invalid section");
      if (result.error === "not_found") return notFound("Section not found");
      if (result.error === "suspended") {
        return suspensionForbidden("reason" in result ? result.reason : null);
      }
      return forbidden();
    }

    const homework = result.homework;
    const homeworkItem = await requireHomeworkItemById({
      homeworkId: homework.id,
      locale: getRequestLocale(request),
      userId,
    });
    return createdJsonResponse(
      { id: homework.id, homework: homeworkItem },
      `/api/community/section-homeworks/${encodeURIComponent(homework.id)}`,
    );
  } catch (error) {
    return handleRouteError("Failed to create homework", error);
  }
}

export async function patchHomeworkRoute(request: Request, params: IdParams) {
  const id = parseHomeworkId(params);
  if (id instanceof Response) return id;

  const auth = await requireAuthPrincipal(request, {
    bearerScope: { feature: "community.section-homework", action: "write" },
  });
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;
  const audit = {
    ...attributionFromApiPrincipal(auth),
    requestId: getAuditRequestMetadata(request).requestId,
  };

  const parsedBody = await parseRouteJsonBody(
    request,
    homeworkUpdateRequestSchema,
    "Invalid homework update",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  try {
    return await updateHomeworkAction(
      id,
      userId,
      getRequestLocale(request),
      parsedBody,
      audit,
    );
  } catch (error) {
    return handleRouteError("Failed to update homework", error);
  }
}

export async function deleteHomeworkRoute(request: Request, params: IdParams) {
  const id = parseHomeworkId(params);
  if (id instanceof Response) return id;
  const auth = await requireAuthPrincipal(request, {
    bearerScope: { feature: "community.section-homework", action: "write" },
  });
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    return await deleteHomeworkAction(id, userId, {
      ...attributionFromApiPrincipal(auth),
      requestId: getAuditRequestMetadata(request).requestId,
    });
  } catch (error) {
    return handleRouteError("Failed to delete homework", error);
  }
}
