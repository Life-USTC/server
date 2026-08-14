import {
  HOMEWORK_LIST_DEFAULT_PAGE_SIZE,
  HOMEWORK_LIST_MAX_PAGE_SIZE,
} from "@/features/homeworks/lib/homework-list-bounds";
import {
  getRequestSearchParams,
  handleRouteError,
  jsonResponse,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { subscribedHomeworksQuerySchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";
import {
  runWithWorkspaceRouteAttribution,
  runWorkspaceRouteStage,
} from "@/lib/log/workspace-route-attribution";

export async function getSubscribedHomeworksRoute(request: Request) {
  const auth = await runWorkspaceRouteStage(
    "homeworks",
    "auth",
    { request },
    () =>
      requireAuth(request, {
        bearerScope: { feature: "workspace.homework", action: "read" },
      }),
  );
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const locale = getRequestLocale(request);

  const parsed = parseRouteQuery(
    getRequestSearchParams(request),
    subscribedHomeworksQuerySchema,
    "Invalid subscribed homework query",
    {
      pagination: {
        defaultPageSize: HOMEWORK_LIST_DEFAULT_PAGE_SIZE,
        maxPageSize: HOMEWORK_LIST_MAX_PAGE_SIZE,
        pageSizeAliasParam: "pageSize",
      },
    },
  );
  if (parsed instanceof Response) return parsed;

  return runWithWorkspaceRouteAttribution("homeworks", request, async () => {
    try {
      const { listSubscribedHomeworkPage } = await import(
        "@/features/subscriptions/server/subscription-read-model"
      );
      const page = await runWorkspaceRouteStage(
        "homeworks",
        "read",
        { request },
        () =>
          listSubscribedHomeworkPage(userId, {
            includeEditors: true,
            locale,
            pagination: parsed.pagination,
          }),
      );
      return jsonResponse(page);
    } catch (error) {
      return handleRouteError("Failed to fetch subscribed homeworks", error);
    }
  });
}
