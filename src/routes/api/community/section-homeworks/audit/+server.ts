import { getDemoHomeworkAuditRoute } from "@/lib/api/routes/demo-homework-read-routes";
import { getHomeworkAuditRoute } from "@/lib/api/routes/homework-audit-read-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * List section homework audit history after an explicit request.
 * @params homeworkAuditQuerySchema
 * @response homeworkAuditListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoHomeworkAuditRoute(event.request)
    : svelteRequestHandler(observedApiRoute(getHomeworkAuditRoute))(event);
