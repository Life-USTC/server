import type { NextRequest } from "next/server";
import {
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { sectionsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { buildSectionListQuery } from "@/lib/course-section-queries";
import { observedApiRoute } from "@/lib/log/api-observability";
import { paginatedSectionQuery } from "@/lib/query-helpers";

export const dynamic = "force-dynamic";

/**
 * List sections with filters and pagination.
 * @params sectionsQuerySchema
 * @response paginatedSectionResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = parseRouteQuery(
    searchParams,
    sectionsQuerySchema,
    "Invalid section query",
    { logErrors: true },
  );
  if (parsed instanceof Response) {
    return parsed;
  }

  const { query: parsedQuery, pagination } = parsed;
  const {
    courseId,
    courseJwId,
    semesterId,
    semesterJwId,
    campusId,
    departmentId,
    teacherId,
    teacherCode,
    search,
    ids: idsParam,
    jwIds,
  } = parsedQuery;
  const { where, orderBy } = buildSectionListQuery({
    courseId,
    courseJwId,
    semesterId,
    semesterJwId,
    campusId,
    departmentId,
    teacherId,
    teacherCode,
    ids: idsParam,
    jwIds,
    search,
  });

  try {
    const result = await paginatedSectionQuery(
      pagination.page,
      pagination.pageSize,
      where,
      orderBy,
    );
    return jsonResponse(result);
  } catch (error) {
    return handleRouteError("Failed to fetch sections", error);
  }
}
export const GET = observedApiRoute(getRoute);
