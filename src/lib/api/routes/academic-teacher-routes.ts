import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { parseResourceIdRouteParam } from "@/lib/api/routes/academic-route-helpers";
import { resolvePublicCatalogLocale } from "@/lib/api/routes/request-locale";
import { teachersQuerySchema } from "@/lib/api/schemas/request-schemas";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const TEACHERS_API_CACHE_TTL_MS = 60_000;

export async function getTeachersRoute(request: Request) {
  const localeResolution = resolvePublicCatalogLocale(request);
  if (localeResolution instanceof Response) {
    return localeResolution;
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = parseRouteQuery(
    searchParams,
    teachersQuerySchema,
    "Invalid teacher query",
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
      publicRuntimeCacheKey(`api:teachers:${locale}`, searchParams),
      TEACHERS_API_CACHE_TTL_MS,
      async () => {
        const { listTeacherSummaries } = await import(
          "@/features/catalog/server/course-section-queries"
        );
        return listTeacherSummaries({
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
    return handleRouteError("Failed to fetch teachers", error);
  }
}

export async function getTeacherDetailRoute(
  request: Request,
  params: { id: string },
) {
  try {
    const parsedId = parseResourceIdRouteParam(params, "teacher ID");
    if (parsedId instanceof Response) return parsedId;

    const localeResolution = resolvePublicCatalogLocale(request);
    if (localeResolution instanceof Response) {
      return localeResolution;
    }

    const { findTeacherDetailById } = await import(
      "@/features/catalog/server/course-section-queries"
    );
    const teacher = await findTeacherDetailById(
      parsedId,
      localeResolution.locale,
    );

    if (!teacher) {
      return notFound("Teacher not found");
    }

    return jsonResponse(teacher, {
      headers: localeResolution.cacheHeaders,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch teacher", error);
  }
}
