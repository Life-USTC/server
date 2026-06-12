import {
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  homeworkIncludeForViewer,
  homeworkResponseItem,
  homeworkSectionFilter,
  parseHomeworkSectionIds,
} from "@/lib/api/routes/homework-route-helpers";
import { homeworksQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

export async function getHomeworksRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    homeworksQuerySchema,
    "Invalid homework query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  const sectionIdList = parseHomeworkSectionIds(parsedQuery);
  if (sectionIdList instanceof Response) return sectionIdList;

  const includeDeleted = parsedQuery.includeDeleted === "true";
  const sectionFilter = homeworkSectionFilter(sectionIdList);

  try {
    const viewerUserId = await resolveApiUserId(request);
    const [{ getViewerContext }, { getPrisma, prisma }] = await Promise.all([
      import("@/lib/auth/viewer-context"),
      import("@/lib/db/prisma"),
    ]);
    const viewer = await getViewerContext({
      includeAdmin: true,
      userId: viewerUserId,
    });
    const homeworkInclude = homeworkIncludeForViewer(viewer.userId);

    const [homeworks, auditLogs] = await Promise.all([
      getPrisma("zh-cn").homework.findMany({
        where: {
          ...sectionFilter,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
        include: homeworkInclude,
        orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
      }),
      prisma.homeworkAuditLog.findMany({
        where:
          sectionIdList.length === 1
            ? { sectionId: sectionIdList[0] }
            : { sectionId: { in: sectionIdList } },
        include: {
          actor: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return jsonResponse({
      viewer,
      homeworks: homeworks.map(homeworkResponseItem),
      auditLogs,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch homeworks", error);
  }
}
