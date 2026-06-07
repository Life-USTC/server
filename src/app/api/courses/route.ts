import type { NextRequest } from "next/server";
import {
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { coursesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { buildCourseListWhere } from "@/lib/course-section-queries";
import { observedApiRoute } from "@/lib/log/api-observability";
import { paginatedCourseQuery } from "@/lib/query-helpers";

export const dynamic = "force-dynamic";

/**
 * List courses with search and pagination.
 * @params coursesQuerySchema
 * @response paginatedCourseResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = parseRouteQuery(
    searchParams,
    coursesQuerySchema,
    "Invalid course query",
    { logErrors: true },
  );
  if (parsed instanceof Response) {
    return parsed;
  }

  const { query: parsedQuery, pagination } = parsed;
  const { search, educationLevelId, categoryId, classTypeId } = parsedQuery;
  const where = buildCourseListWhere({
    search,
    educationLevelId,
    categoryId,
    classTypeId,
  });

  try {
    const result = await paginatedCourseQuery(
      pagination.page,
      pagination.pageSize,
      where,
    );
    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to fetch courses", error);
  }
}
export const GET = observedApiRoute(getRoute);
