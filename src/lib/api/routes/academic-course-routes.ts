import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { parseJwIdRouteParam } from "@/lib/api/routes/academic-route-helpers";
import { coursesQuerySchema } from "@/lib/api/schemas/request-schemas";

export async function getCoursesRoute(request: Request) {
  const searchParams = new URL(request.url).searchParams;
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
  const { buildCourseListWhere } = await import("@/lib/course-section-queries");
  const where = buildCourseListWhere({
    search,
    educationLevelId,
    categoryId,
    classTypeId,
  });

  try {
    const { paginatedCourseQuery } = await import("@/lib/query-helpers");
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

export async function getCourseDetailRoute(params: { jwId: string }) {
  try {
    const parsedJwId = parseJwIdRouteParam(params, "course ID");
    if (parsedJwId instanceof Response) return parsedJwId;

    const { findCourseDetailByJwId } = await import(
      "@/lib/course-section-queries"
    );
    const course = await findCourseDetailByJwId(parsedJwId, "zh-cn");

    if (!course) {
      return notFound("Course not found");
    }

    return jsonResponse(course);
  } catch (error) {
    return handleRouteError("Failed to fetch course", error);
  }
}
