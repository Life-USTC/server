import { getDemoTeacherList } from "@/features/demo/server/demo-teacher-list";
import type { AppLocale } from "@/i18n/config";
import { parseRouteQuery } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { teachersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { paginatedTeacherResponseSchema } from "@/lib/api/schemas/response-schemas";

export function getDemoTeacherListRoute(request: Request, locale: AppLocale) {
  const params = new URL(request.url).searchParams;
  const parsed = parseRouteQuery(
    params,
    teachersQuerySchema.strict(),
    "Invalid teacher query",
  );
  if (parsed instanceof Response) return parsed;
  return schemaJsonResponse(
    paginatedTeacherResponseSchema,
    getDemoTeacherList(
      params.has("locale") ? parsed.query.locale : locale,
      parsed.query,
      parsed.pagination,
    ),
  );
}
