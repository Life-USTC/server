import { getSectionsCalendarRoute } from "@/lib/api/routes/calendars";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Generate calendar ICS for multiple sections.
 * @params sectionsCalendarQuerySchema
 * @response 200:binary
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(
  observedApiRoute(getSectionsCalendarRoute),
);
