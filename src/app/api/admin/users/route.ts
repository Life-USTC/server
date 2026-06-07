import type { NextRequest } from "next/server";
import { ADMIN_USERS_PAGE_SIZE } from "@/app/admin/users/constants";
import { withAdminRoute } from "@/lib/admin-utils";
import {
  buildPaginatedResponse,
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { adminUsersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { ilike } from "@/lib/query-helpers";

export const dynamic = "force-dynamic";

/**
 * List users for admin console.
 * @params adminUsersQuerySchema
 * @response adminUsersResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  return withAdminRoute("Failed to fetch users", async () => {
    const searchParams = getRequestSearchParams(request);
    const parsed = parseRouteQuery(
      searchParams,
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
    if (parsed instanceof Response) {
      return parsed;
    }

    const { query: parsedQuery, pagination } = parsed;
    const search = parsedQuery.search ?? "";
    const where = search
      ? {
          OR: [
            { id: ilike(search) },
            { name: ilike(search) },
            { username: ilike(search) },
            {
              verifiedEmails: {
                some: {
                  email: ilike(search),
                },
              },
            },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          username: true,
          isAdmin: true,
          createdAt: true,
          verifiedEmails: {
            select: { email: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return jsonResponse(
      buildPaginatedResponse(
        users.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          isAdmin: u.isAdmin,
          email: u.verifiedEmails?.[0]?.email ?? null,
          createdAt: u.createdAt,
        })),
        pagination.page,
        pagination.pageSize,
        total,
      ),
    );
  });
}
export const GET = observedApiRoute(getRoute);
