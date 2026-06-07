import { withAdminRoute } from "@/lib/admin-utils";
import {
  getRequestSearchParams,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { adminDescriptionsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { ilike } from "@/lib/query-helpers";

export const dynamic = "force-dynamic";

/**
 * List descriptions for moderation review.
 * @params adminDescriptionsQuerySchema
 * @response adminDescriptionsResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: Request) {
  return withAdminRoute(
    "Failed to fetch descriptions moderation queue",
    async () => {
      const searchParams = getRequestSearchParams(request);
      const parsed = parseRouteQuery(
        searchParams,
        adminDescriptionsQuerySchema,
        "Invalid descriptions moderation query",
        {
          logErrors: true,
          pagination: { defaultPageSize: 50, maxPageSize: 200 },
        },
      );
      if (parsed instanceof Response) {
        return parsed;
      }

      const { query: parsedQuery, pagination } = parsed;
      const targetType = parsedQuery.targetType ?? "all";
      const hasContent = parsedQuery.hasContent ?? "withContent";
      const search = parsedQuery.search?.trim() ?? "";
      const { pageSize: limit } = pagination;

      const targetTypeWhere =
        targetType === "section"
          ? { sectionId: { not: null } }
          : targetType === "course"
            ? { courseId: { not: null } }
            : targetType === "teacher"
              ? { teacherId: { not: null } }
              : targetType === "homework"
                ? { homeworkId: { not: null } }
                : {};

      const contentWhere =
        hasContent === "empty"
          ? { content: "" }
          : hasContent === "withContent"
            ? { content: { not: "" } }
            : {};

      const searchWhere = search
        ? {
            OR: [
              { content: ilike(search) },
              {
                course: {
                  code: ilike(search),
                },
              },
              {
                course: {
                  nameCn: ilike(search),
                },
              },
              {
                section: {
                  course: {
                    code: ilike(search),
                  },
                },
              },
              {
                section: {
                  course: {
                    nameCn: ilike(search),
                  },
                },
              },
              {
                section: {
                  code: ilike(search),
                },
              },
              {
                teacher: {
                  nameCn: ilike(search),
                },
              },
              {
                homework: {
                  title: ilike(search),
                },
              },
              {
                homework: {
                  section: {
                    course: {
                      code: ilike(search),
                    },
                  },
                },
              },
              {
                homework: {
                  section: {
                    course: {
                      nameCn: ilike(search),
                    },
                  },
                },
              },
            ],
          }
        : {};

      const descriptions = await prisma.description.findMany({
        where: {
          ...targetTypeWhere,
          ...contentWhere,
          ...searchWhere,
        },
        include: {
          lastEditedBy: {
            select: { id: true, name: true, username: true, image: true },
          },
          section: {
            select: {
              jwId: true,
              code: true,
              course: { select: { jwId: true, code: true, nameCn: true } },
            },
          },
          course: { select: { jwId: true, code: true, nameCn: true } },
          teacher: { select: { id: true, nameCn: true } },
          homework: {
            select: {
              id: true,
              title: true,
              section: {
                select: {
                  jwId: true,
                  code: true,
                  course: { select: { jwId: true, code: true, nameCn: true } },
                },
              },
            },
          },
        },
        orderBy: [{ lastEditedAt: "desc" }, { updatedAt: "desc" }],
        take: limit,
      });

      return jsonResponse({ descriptions });
    },
  );
}
export const GET = observedApiRoute(getRoute);
