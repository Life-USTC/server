import { withAdminApiRoute } from "@/lib/admin-api";
import { ADMIN_USERS_PAGE_SIZE } from "@/lib/admin-constants";
import {
  getRequestSearchParams,
  parseRouteJsonBody,
  parseRouteQuery,
} from "@/lib/api/helpers";
import {
  listAdminUsersAction,
  updateAdminUserAction,
} from "@/lib/api/routes/admin-user-actions";
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

    return listAdminUsersAction(parsed);
  });
}

export async function patchAdminUserRoute(request: Request, params: IdParams) {
  return withAdminApiRoute(request, "Failed to update user", async () => {
    const parsed = parseIdParam(params, "user");
    if (parsed instanceof Response) return parsed;
    const parsedBody = await parseRouteJsonBody(
      request,
      adminUpdateUserRequestSchema,
      "Invalid update request",
    );
    if (parsedBody instanceof Response) return parsedBody;

    return updateAdminUserAction(parsed.id, parsedBody);
  });
}
