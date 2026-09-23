import { getYoungOrganizersRoute } from "@/lib/api/routes/young-event-routes";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List normalized Young organizers and their active, upcoming, and historical
 * event groups.
 * @params youngOrganizersQuerySchema
 * @response paginatedYoungOrganizerResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getYoungOrganizersRoute),
);
