import { listAdminModerationHomeworks } from "@/features/admin/server/admin-moderation-api-lists";
import {
  buildPaginatedResponse,
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import { adminHomeworksQuerySchema } from "@/lib/api/schemas/request-schemas";

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
      const search = parsedQuery.search?.trim() ?? "";
      const result = await listAdminModerationHomeworks({
        pageSize: pagination.pageSize,
        search,
        skip: pagination.skip,
        status,
      });

      return jsonResponse(
        buildPaginatedResponse(
          result.data,
          pagination.page,
          pagination.pageSize,
          result.total,
        ),
      );
    },
  );
}
