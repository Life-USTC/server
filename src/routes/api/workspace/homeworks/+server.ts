import { getDemoSubscribedHomeworksRoute } from "@/lib/api/routes/demo-homework-read-routes";
import { getSubscribedHomeworksRoute } from "@/lib/api/routes/homework-subscribed-read-route";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * List subscribed homeworks.
 * @params subscribedHomeworksQuerySchema
 * @response subscribedHomeworksResponseSchema
 * @response 400:openApiErrorSchema
 * @response 401:openApiErrorSchema
 * @oauthScope workspace.homework:read
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoSubscribedHomeworksRoute(event.request, event.locals.locale)
    : svelteRequestHandler(observedApiRoute(getSubscribedHomeworksRoute))(
        event,
      );
