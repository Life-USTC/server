import { updateAdminUser } from "@/features/admin/server/admin-api-service";
import { ADMIN_USERS_PAGE_SIZE } from "@/features/admin/server/admin-constants";
import { listAdminUsers } from "@/features/admin/server/admin-user-read-model";
import {
  badRequest,
  buildPaginatedResponse,
  getRequestSearchParams,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import {
  adminUpdateUserRequestSchema,
  adminUsersQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import { type IdParams, parseIdParam } from "./admin-shared";

export async function getAdminUsersRoute(request: Request) {
  return withAdminApiRoute(request, "Failed to fetch users", async () => {
    const parsed = parseRouteQuery(
      getRequestSearchParams(request),
      adminUsersQuerySchema,
      "Invalid user query",
      {
        logErrors: true,
        pagination: {
          defaultPageSize: ADMIN_USERS_PAGE_SIZE,
          maxPageSize: 100,
        },
      },
    );
    if (parsed instanceof Response) return parsed;

    const result = await listAdminUsers(parsed);
    return jsonResponse(
      buildPaginatedResponse(
        result.users,
        parsed.pagination.page,
        parsed.pagination.pageSize,
        result.total,
      ),
    );
  });
}

export async function patchAdminUserRoute(request: Request, params: IdParams) {
  return withAdminApiRoute(request, "Failed to update user", async (admin) => {
    const parsed = parseIdParam(params, "user");
    if (parsed instanceof Response) return parsed;
    const parsedBody = await parseRouteJsonBody(
      request,
      adminUpdateUserRequestSchema,
      "Invalid update request",
    );
    if (parsedBody instanceof Response) return parsedBody;

    const result = await updateAdminUser(admin.userId, parsed.id, parsedBody);
    if (!result.ok) {
      if (result.reason === "invalid_username")
        return badRequest("Invalid username");
      if (result.reason === "username_taken") {
        return badRequest("Username already taken");
      }
      if (result.reason === "cannot_demote_self") {
        return badRequest("Admins cannot remove their own admin role");
      }
      if (result.reason === "cannot_remove_last_admin") {
        return badRequest("At least one admin must remain");
      }
      return notFound("User not found");
    }

    return jsonResponse({ user: result.user });
  });
}
