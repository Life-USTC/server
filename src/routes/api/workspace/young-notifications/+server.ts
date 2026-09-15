import type { RequestHandler } from "@sveltejs/kit";
import { getYoungWorkspaceRoute } from "@/lib/api/routes/young-workspace-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
/**
 * List personal young-notifications.
 * @params youngWorkspaceQuerySchema
 * @response youngNotificationListSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request }) =>
  observedApiRoute(() => getYoungWorkspaceRoute(request, "notifications"))(
    request,
  );
