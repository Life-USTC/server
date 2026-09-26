import { listSubscribedExamPage } from "@/features/subscriptions/server/subscription-read-model";
import { handleRouteError, parseRouteSearchParams } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import {
  subscribedExamDtoSchema,
  subscribedExamsQuerySchema,
  subscribedExamsResponseSchema,
} from "@/lib/api/schemas/subscribed-exams-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";

export async function getSubscribedExamsRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "workspace.exam", action: "read" },
  });
  if (auth instanceof Response) return auth;
  const query = parseRouteSearchParams(
    new URL(request.url).searchParams,
    subscribedExamsQuerySchema,
    "Invalid subscribed exams query",
  );
  if (query instanceof Response) return query;

  try {
    const { page, pageSize, locale, ...filters } = query;
    const result = await listSubscribedExamPage(auth.userId, {
      ...filters,
      locale: locale ?? getRequestLocale(request),
      pagination: { page, pageSize },
    });
    return schemaJsonResponse(subscribedExamsResponseSchema, {
      ...result,
      data: result.data.map((exam) =>
        subscribedExamDtoSchema.parse(serializeDatesDeep(exam)),
      ),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch subscribed exams", error);
  }
}
