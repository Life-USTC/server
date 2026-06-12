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
  const where = await buildTeacherWhere({ departmentId, search });

  try {
    const { paginatedTeacherQuery } = await import("@/lib/query-helpers");
    const result = await paginatedTeacherQuery(
      pagination.page,
      pagination.pageSize,
      where,
      {
        nameCn: "asc",
      },
    );
    return jsonResponse(result);
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
