import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import {
  handleRouteError,
  jsonResponse,
  parseInteger,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { teachersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { observedApiRoute } from "@/lib/log/api-observability";
import { ilike, paginatedTeacherQuery } from "@/lib/query-helpers";

export const dynamic = "force-dynamic";

/**
 * List teachers with department/search filters.
 * @params teachersQuerySchema
 * @response paginatedTeacherResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
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

  const where: Prisma.TeacherWhereInput = {};

  if (departmentId) {
    const parsedDepartmentId = parseInteger(departmentId);
    if (parsedDepartmentId !== null) {
      where.departmentId = parsedDepartmentId;
    }
  }

  if (search) {
    where.OR = [
      { nameCn: ilike(search) },
      { nameEn: ilike(search) },
      { code: ilike(search) },
    ];
  }

  try {
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
export const GET = observedApiRoute(getRoute);
