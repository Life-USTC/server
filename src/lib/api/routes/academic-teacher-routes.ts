import { buildTeacherWhere } from "@/features/catalog/server/teacher-query";
import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { parseResourceIdRouteParam } from "@/lib/api/routes/academic-route-helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { teachersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { PUBLIC_LOCALE_CATALOG_HEADERS } from "@/lib/public-cache-control";
import {
  cachedPublicRuntimeData,
  publicRuntimeCacheKey,
} from "@/lib/public-runtime-cache";

const TEACHERS_API_CACHE_TTL_MS = 60_000;

export async function getTeachersRoute(request: Request) {
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
  const { departmentId, search } = parsedQuery;
  const locale = getRequestLocale(request);

  try {
    const result = await cachedPublicRuntimeData(
      publicRuntimeCacheKey(`api:teachers:${locale}`, searchParams),
      TEACHERS_API_CACHE_TTL_MS,
      async () => {
        const where = await buildTeacherWhere({ departmentId, search });
        const { paginatedTeacherQuery } = await import(
          "@/features/catalog/server/academic-paginated-queries"
        );
        return paginatedTeacherQuery(
          pagination.page,
          pagination.pageSize,
          where,
          {
            nameCn: "asc",
          },
          locale,
        );
      },
    );
    return jsonResponse(result, {
      headers: PUBLIC_LOCALE_CATALOG_HEADERS,
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

    const [{ getPrisma }, { teacherDetailInclude }] = await Promise.all([
      import("@/lib/db/prisma"),
      import("@/features/catalog/server/academic-query-includes"),
    ]);
    const teacher = await getPrisma(
      getRequestLocale(request),
    ).teacher.findUnique({
      where: { id: parsedId },
      include: teacherDetailInclude,
    });

    if (!teacher) {
      return notFound("Teacher not found");
    }

    return jsonResponse(teacher);
  } catch (error) {
    return handleRouteError("Failed to fetch teacher", error);
  }
}
