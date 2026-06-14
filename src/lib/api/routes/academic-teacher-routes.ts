import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import {
  buildTeacherWhere,
  parseResourceIdRouteParam,
} from "@/lib/api/routes/academic-route-helpers";
import { teachersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { PUBLIC_CATALOG_CACHE_CONTROL } from "@/lib/public-cache-control";
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

  try {
    const result = await cachedPublicRuntimeData(
      publicRuntimeCacheKey("api:teachers", searchParams),
      TEACHERS_API_CACHE_TTL_MS,
      async () => {
        const where = await buildTeacherWhere({ departmentId, search });
        const { paginatedTeacherQuery } = await import("@/lib/query-helpers");
        return paginatedTeacherQuery(
          pagination.page,
          pagination.pageSize,
          where,
          {
            nameCn: "asc",
          },
        );
      },
    );
    return jsonResponse(result, {
      headers: { "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL },
    });
  } catch (error) {
    return handleRouteError("Failed to fetch teachers", error);
  }
}

export async function getTeacherDetailRoute(params: { id: string }) {
  try {
    const parsedId = parseResourceIdRouteParam(params, "teacher ID");
    if (parsedId instanceof Response) return parsedId;

    const [{ getPrisma }, { teacherDetailInclude }] = await Promise.all([
      import("@/lib/db/prisma"),
      import("@/lib/query-helpers"),
    ]);
    const teacher = await getPrisma("zh-cn").teacher.findUnique({
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
