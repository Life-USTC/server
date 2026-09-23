import { getHomeworkAuditRoute } from "@/lib/api/routes/homework-audit-read-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List section homework audit history after an explicit request.
 * @params homeworkAuditQuerySchema
 * @response homeworkAuditListResponseSchema
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getHomeworkAuditRoute),
);
