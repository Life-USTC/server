import type { NextRequest } from "next/server";
import {
  buildPaginatedResponse,
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { semestersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * List semesters with pagination.
 * @params semestersQuerySchema
 * @response paginatedSemesterResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = parseRouteQuery(
      searchParams,
      semestersQuerySchema,
      "Invalid semester query",
      { logErrors: true },
    );
    if (parsed instanceof Response) {
      return parsed;
    }
    const { page, pageSize, skip } = parsed.pagination;

    const [semesters, total] = await Promise.all([
      prisma.semester.findMany({
        skip,
        take: pageSize,
        orderBy: { startDate: "desc" },
      }),
      prisma.semester.count(),
    ]);

    return jsonResponse(
      buildPaginatedResponse(semesters, page, pageSize, total),
    );
  } catch (error) {
    return handleRouteError("Failed to fetch semesters", error);
  }
}
export const GET = observedApiRoute(getRoute);
