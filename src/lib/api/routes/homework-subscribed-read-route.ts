import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { getRequestLocale } from "@/lib/api/routes/request-locale";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getSubscribedHomeworksRoute(request: Request) {
  const auth = await requireAuth(request);
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

    const viewer = await getViewerContext({
      includeAdmin: true,
      userId,
    });

    const sectionIds = await getSubscribedSectionIds(userId);

    if (sectionIds.length === 0) {
      return jsonResponse({
        viewer,
        homeworks: [],
        auditLogs: [],
        sectionIds: [],
      });
    }

    const [homeworks, auditLogs] = await Promise.all([
      listSubscribedHomeworks(userId, {
        locale,
        includeEditors: true,
        sectionIds,
      }),
      listSubscribedHomeworkAuditLogs(userId, 50, sectionIds),
    ]);

    const responseHomeworks = await withHomeworkItemState(homeworks);

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
