import {
  getSubscribedSectionIds,
  listSubscribedHomeworkAuditLogs,
  listSubscribedHomeworks,
} from "@/features/home/server/subscription-read-model";
import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { requireAuth } from "@/lib/auth/helpers";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * List homeworks for all subscribed sections in a single call.
 * @response subscribedHomeworksResponseSchema
 * @response 401:openApiErrorSchema
 */
async function getRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
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
        locale: "zh-cn",
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
export const GET = observedApiRoute(getRoute);
