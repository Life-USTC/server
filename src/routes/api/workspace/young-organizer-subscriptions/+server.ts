import type { RequestHandler } from "@sveltejs/kit";
import { getDemoYoungWorkspaceRoute } from "@/lib/api/routes/demo-young-workspace-route";
import { getYoungWorkspaceRoute } from "@/lib/api/routes/young-workspace-routes";
import { observedApiRoute } from "@/lib/log/api-observability";
/**
 * List personal young-organizer-subscriptions.
 * @params youngWorkspaceQuerySchema
 * @response youngOrganizerSubscriptionListSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @oauthScope workspace.young-subscription:read
 */
export const GET: RequestHandler = ({ request, locals }) =>
  locals.demo
    ? getDemoYoungWorkspaceRoute(request, "organizers", locals.locale)
    : observedApiRoute(() => getYoungWorkspaceRoute(request, "organizers"))(
        request,
      );
