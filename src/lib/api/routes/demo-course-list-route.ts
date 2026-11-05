import { getDemoCourseList } from "@/features/demo/server/demo-course-list";
import type { AppLocale } from "@/i18n/config";
import { parseRouteQuery } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { coursesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { paginatedCourseResponseSchema } from "@/lib/api/schemas/response-schemas";

export function getDemoCourseListRoute(request: Request, locale: AppLocale) {
  const params = new URL(request.url).searchParams;
  const parsed = parseRouteQuery(
    params,
    coursesQuerySchema.strict(),
    "Invalid course query",
  );
  if (parsed instanceof Response) return parsed;
  return schemaJsonResponse(
    paginatedCourseResponseSchema,
    getDemoCourseList(
      params.has("locale") ? parsed.query.locale : locale,
      parsed.query,
      parsed.pagination,
    ),
  );
}
