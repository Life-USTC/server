import { getDemoYoungOrganizersRoute } from "@/lib/api/routes/demo-young-route";
import { getYoungOrganizersRoute } from "@/lib/api/routes/young-event-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

const ordinaryGET = svelteRequestHandler(
  observedApiRoute(getYoungOrganizersRoute),
);

/**
 * List normalized Young organizers and their active, upcoming, and historical
 * event groups.
 * @params youngOrganizersQuerySchema
 * @response paginatedYoungOrganizerResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = (event) =>
  event.locals.demo
    ? getDemoYoungOrganizersRoute(event.request, event.locals.locale)
    : ordinaryGET(event);
