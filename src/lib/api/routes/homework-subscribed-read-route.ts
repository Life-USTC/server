import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
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

  return runWithWorkspaceRouteAttribution("homeworks", request, async () => {
    try {
      const [{ getViewerContext }, subscriptionReadModel, homeworkItemState] =
        await Promise.all([
          import("@/lib/auth/viewer-context"),
          import("@/features/subscriptions/server/subscription-read-model"),
          import("@/features/homeworks/server/homework-item-state"),
        ]);
      const {
        getSubscribedSectionIds,
        listSubscribedHomeworkAuditLogs,
        listSubscribedHomeworks,
      } = subscriptionReadModel;
      const { withHomeworkItemState } = homeworkItemState;

      const [viewer, sectionIds] = await Promise.all([
        runWorkspaceRouteStage("homeworks", "viewer", { request }, () =>
          getViewerContext({
            includeAdmin: true,
            userId,
          }),
        ),
        runWorkspaceRouteStage("homeworks", "section_ids", { request }, () =>
          getSubscribedSectionIds(userId),
        ),
      ]);

      if (sectionIds.length === 0) {
        return jsonResponse({
          viewer,
          homeworks: [],
          auditLogs: [],
          sectionIds: [],
        });
      }

      const [homeworks, auditLogs] = await Promise.all([
        runWorkspaceRouteStage("homeworks", "read", { request }, () =>
          listSubscribedHomeworks(userId, {
            locale,
            includeEditors: true,
            sectionIds,
          }),
        ),
        runWorkspaceRouteStage("homeworks", "audit", { request }, () =>
          listSubscribedHomeworkAuditLogs(userId, 50, sectionIds),
        ),
      ]);

      const responseHomeworks = await runWorkspaceRouteStage(
        "homeworks",
        "item_state",
        { request },
        () => withHomeworkItemState(homeworks),
      );

      return jsonResponse({
        viewer,
        homeworks: responseHomeworks,
        auditLogs,
        sectionIds,
      });
    } catch (error) {
      return handleRouteError("Failed to fetch subscribed homeworks", error);
    }
  });
}
