import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List exams across the current user's subscribed sections and semesters.
 * @params subscribedExamsQuerySchema
 * @response subscribedExamsResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getSubscribedExamsRoute),
);
