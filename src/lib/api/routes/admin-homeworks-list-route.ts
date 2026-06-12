import { withAdminApiRoute } from "@/lib/admin-api";
import {
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { adminHomeworksQuerySchema } from "@/lib/api/schemas/request-schemas";
import {
  adminHomeworkInclude,
  buildAdminHomeworkWhere,
} from "./admin-homework-filters";

export async function getAdminHomeworksRoute(request: Request) {
  return withAdminApiRoute(
    request,
    "Failed to fetch homework moderation queue",
    async () => {
      const parsed = parseRouteQuery(
        getRequestSearchParams(request),
        adminHomeworksQuerySchema,
        "Invalid homework moderation query",
        {
          logErrors: true,
          pagination: { defaultPageSize: 50, maxPageSize: 200 },
        },
      );
      if (parsed instanceof Response) return parsed;

      const { query: parsedQuery, pagination } = parsed;
      const status = parsedQuery.status ?? "all";
      const { pageSize: limit } = pagination;
      const search = parsedQuery.search?.trim() ?? "";
      const where = buildAdminHomeworkWhere({ search, status });

      const { prisma } = await import("@/lib/db/prisma");
      const homeworks = await prisma.homework.findMany({
        where,
        include: adminHomeworkInclude,
        orderBy: [{ deletedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
      });

      return jsonResponse({ homeworks });
    },
  );
}
