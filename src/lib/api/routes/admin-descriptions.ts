import { withAdminApiRoute } from "@/lib/admin-api";
import {
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { adminDescriptionsQuerySchema } from "@/lib/api/schemas/request-schemas";
import {
  adminDescriptionInclude,
  buildAdminDescriptionWhere,
} from "./admin-description-filters";

export async function getAdminDescriptionsRoute(request: Request) {
  return withAdminApiRoute(
    request,
    "Failed to fetch descriptions moderation queue",
    async () => {
      const parsed = parseRouteQuery(
        getRequestSearchParams(request),
        adminDescriptionsQuerySchema,
        "Invalid descriptions moderation query",
        {
          logErrors: true,
          pagination: { defaultPageSize: 50, maxPageSize: 200 },
        },
      );
      if (parsed instanceof Response) return parsed;

      const { query: parsedQuery, pagination } = parsed;
      const targetType = parsedQuery.targetType ?? "all";
      const hasContent = parsedQuery.hasContent ?? "withContent";
      const search = parsedQuery.search?.trim() ?? "";
      const { pageSize: limit } = pagination;
      const where = buildAdminDescriptionWhere({
        hasContent,
        search,
        targetType,
      });

      const { prisma } = await import("@/lib/db/prisma");
      const descriptions = await prisma.description.findMany({
        where,
        include: adminDescriptionInclude,
        orderBy: [{ lastEditedAt: "desc" }, { updatedAt: "desc" }],
        take: limit,
      });

      return jsonResponse({ descriptions });
    },
  );
}
