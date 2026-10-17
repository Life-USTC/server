import { getCommunityUserRoute } from "@/lib/api/routes/public-user-profile";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get one public community user.
 * @pathParams communityUserIdentifierPathParamsSchema
 * @response publicUserProfileResponseSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params }) =>
  observedApiRoute(() => getCommunityUserRoute(params.identifier))(request);
