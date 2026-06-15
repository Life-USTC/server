import { getSubscribedHomeworksRoute } from "@/lib/api/routes/homeworks";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List subscribed homeworks.
 * @response subscribedHomeworksResponseSchema
 * @response 401:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getSubscribedHomeworksRoute),
);
