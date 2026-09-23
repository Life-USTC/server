import type { RequestHandler } from "@sveltejs/kit";
import { getCommunityUserRoute } from "@/lib/api/routes/public-user-profile";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Get one public community user.
 * @pathParams communityUserIdentifierPathParamsSchema
 * @response publicUserProfileResponseSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCommunityUserRoute(params.identifier))(request);
