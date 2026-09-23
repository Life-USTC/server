import { getSubscribedHomeworksRoute } from "@/lib/api/routes/homework-subscribed-read-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List subscribed homeworks.
 * @params subscribedHomeworksQuerySchema
 * @response subscribedHomeworksResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getSubscribedHomeworksRoute),
);
