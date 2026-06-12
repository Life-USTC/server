import { getAdminUsersRoute } from "@/lib/api/routes/admin";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * List users for admin console.
 * @params adminUsersQuerySchema
 * @response adminUsersResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET = svelteRequestHandler(observedApiRoute(getAdminUsersRoute));
