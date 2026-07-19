import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { parseJwIdRouteParam } from "@/lib/api/routes/academic-route-helpers";
import { resolvePublicCatalogLocale } from "@/lib/api/routes/request-locale";
import { coursesQuerySchema } from "@/lib/api/schemas/request-schemas";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const COURSES_API_CACHE_TTL_MS = 60_000;

export async function getCoursesRoute(request: Request) {
  const localeResolution = resolvePublicCatalogLocale(request);
  if (localeResolution instanceof Response) {
    return localeResolution;
  }

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
  const { locale: _locale, ...filters } = parsedQuery;
  const { cacheHeaders, locale } = localeResolution;

  try {
    const result = await cachedPublicRuntimeData(
      publicRuntimeCacheKey(`api:courses:${locale}`, searchParams),
      COURSES_API_CACHE_TTL_MS,
      async () => {
        const { listCourseSummaries } = await import(
          "@/features/catalog/server/course-section-queries"
        );
        return listCourseSummaries({
          filters,
          locale,
          pagination,
        });
      },
    );
    return jsonResponse(result, {
      headers: cacheHeaders,
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

    const localeResolution = resolvePublicCatalogLocale(request);
    if (localeResolution instanceof Response) {
      return localeResolution;
    }

    const { findCourseDetailByJwId } = await import(
      "@/features/catalog/server/course-section-queries"
    );
    const course = await findCourseDetailByJwId(
      parsedJwId,
      localeResolution.locale,
    );

    if (!course) {
      return notFound("Course not found");
    }

    return jsonResponse(course, {
      headers: localeResolution.cacheHeaders,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch course", error);
  }
}
