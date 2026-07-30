import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getSubscribedHomeworksRoute(request: Request) {
  const auth = await runCloudflareTraceSpan(
    "workspace.homeworks.auth",
    {},
    () =>
      requireAuth(request, {
        bearerScope: { feature: "workspace.homework", action: "read" },
      }),
  );
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  const locale = getRequestLocale(request);

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
      runCloudflareTraceSpan("workspace.homeworks.viewer", {}, () =>
        getViewerContext({
          includeAdmin: true,
          userId,
        }),
      ),
      runCloudflareTraceSpan("workspace.homeworks.section_ids", {}, () =>
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
      runCloudflareTraceSpan("workspace.homeworks.read", {}, () =>
        listSubscribedHomeworks(userId, {
          locale,
          includeEditors: true,
          sectionIds,
        }),
      ),
      runCloudflareTraceSpan("workspace.homeworks.audit", {}, () =>
        listSubscribedHomeworkAuditLogs(userId, 50, sectionIds),
      ),
    ]);

    const responseHomeworks = await runCloudflareTraceSpan(
      "workspace.homeworks.item_state",
      {},
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
}
