import type { CommentStatus } from "@/generated/prisma/client";
import { withAdminRoute } from "@/lib/admin-utils";
import {
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { adminCommentsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["active", "softbanned", "deleted"] as const;

/**
 * List moderation comments.
 * @params adminCommentsQuerySchema
 * @response adminCommentsResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: Request) {
  return withAdminRoute("Failed to fetch moderation queue", async () => {
    const searchParams = getRequestSearchParams(request);
    const parsed = parseRouteQuery(
      searchParams,
      adminCommentsQuerySchema,
      "Invalid moderation query",
      {
        logErrors: true,
        pagination: { defaultPageSize: 50, maxPageSize: 200 },
      },
    );
    if (parsed instanceof Response) {
      return parsed;
    }

    const { query: parsedQuery, pagination } = parsed;
    const status = parsedQuery.status ?? "";
    const { pageSize: limit } = pagination;

    const now = new Date();
    const where =
      status === "suspended"
        ? {
            user: {
              suspensions: {
                some: {
                  liftedAt: null,
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
              },
            },
          }
        : STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number])
          ? { status: status as CommentStatus }
          : {};
    const comments = await prisma.comment.findMany({
      where,
      include: {
        user: {
          select: { name: true },
        },
        section: {
          select: {
            jwId: true,
            code: true,
            course: {
              select: { jwId: true, code: true, nameCn: true },
            },
          },
        },
        course: {
          select: { jwId: true, code: true, nameCn: true },
        },
        teacher: {
          select: { id: true, nameCn: true },
        },
        homework: {
          select: {
            id: true,
            title: true,
            section: {
              select: { code: true },
            },
          },
        },
        sectionTeacher: {
          select: {
            section: {
              select: {
                jwId: true,
                code: true,
                course: {
                  select: { jwId: true, code: true, nameCn: true },
                },
              },
            },
            teacher: {
              select: { nameCn: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return jsonResponse(
      { comments },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
export const GET = observedApiRoute(getRoute);
