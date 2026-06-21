import { listAdminModerationDescriptions } from "@/features/admin/server/admin-moderation-api-lists";
import {
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import { adminDescriptionsQuerySchema } from "@/lib/api/schemas/request-schemas";

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
      const descriptions = await listAdminModerationDescriptions({
        hasContent,
        limit,
        search,
        targetType,
      });

      return jsonResponse({ descriptions });
    },
  );
}
