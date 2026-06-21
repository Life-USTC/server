import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { parseJwIdRouteParam } from "@/lib/api/routes/academic-route-helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { coursesQuerySchema } from "@/lib/api/schemas/request-schemas";
import { PUBLIC_LOCALE_CATALOG_HEADERS } from "@/lib/public-cache-control";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const COURSES_API_CACHE_TTL_MS = 60_000;

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
  const locale = getRequestLocale(request);

  try {
    const result = await cachedPublicRuntimeData(
      publicRuntimeCacheKey(`api:courses:${locale}`, searchParams),
      COURSES_API_CACHE_TTL_MS,
      async () => {
        const [{ buildCourseListWhere }, { paginatedCourseQuery }] =
          await Promise.all([
            import("@/features/catalog/server/course-section-queries"),
            import("@/features/catalog/server/academic-paginated-queries"),
          ]);
        const where = buildCourseListWhere({
          search,
          educationLevelId,
          categoryId,
          classTypeId,
        });
        return paginatedCourseQuery(
          pagination.page,
          pagination.pageSize,
          where,
          undefined,
          locale,
        );
      },
    );
    return jsonResponse(result, {
      headers: PUBLIC_LOCALE_CATALOG_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch courses", error);
  }
}

export async function getCourseDetailRoute(
  request: Request,
  params: { jwId: string },
) {
  try {
    const parsedJwId = parseJwIdRouteParam(params, "course ID");
    if (parsedJwId instanceof Response) return parsedJwId;

    const { findCourseDetailByJwId } = await import(
      "@/features/catalog/server/course-section-queries"
    );
    const course = await findCourseDetailByJwId(
      parsedJwId,
      getRequestLocale(request),
    );

    if (!course) {
      return notFound("Course not found");
    }

    return jsonResponse(course);
  } catch (error) {
    return handleRouteError("Failed to fetch course", error);
  }
}
