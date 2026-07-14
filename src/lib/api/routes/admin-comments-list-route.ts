import { normalizeAdminCommentStatusFilter } from "@/features/admin/lib/admin-moderation-filters";
import { listAdminModerationComments } from "@/features/admin/server/admin-moderation-api-lists";
import {
  buildPaginatedResponse,
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import { adminCommentsQuerySchema } from "@/lib/api/schemas/request-schemas";

export async function getAdminCommentsRoute(request: Request) {
  return withAdminApiRoute(
    request,
    "Failed to fetch moderation queue",
    async () => {
      const parsed = parseRouteQuery(
        getRequestSearchParams(request),
        adminCommentsQuerySchema,
        "Invalid moderation query",
        {
          logErrors: true,
          pagination: { defaultPageSize: 50, maxPageSize: 200 },
        },
      );
      if (parsed instanceof Response) return parsed;

      const { query: parsedQuery, pagination } = parsed;
      const status = normalizeAdminCommentStatusFilter(parsedQuery.status);
      const result = await listAdminModerationComments({
        pageSize: pagination.pageSize,
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
        { headers: { "Cache-Control": "no-store" } },
      );
    },
  );
}
