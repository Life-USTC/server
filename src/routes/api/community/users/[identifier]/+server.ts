import { getCommunityUserRoute } from "@/lib/api/routes/public-user-profile";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

/**
 * Get one public community user.
 * @pathParams communityUserIdentifierPathParamsSchema
 * @response publicUserProfileResponseSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params, locals }) => {
  if (locals.demo) {
    const profile = getDemoPublicUserProfile(params.identifier, locals.locale);
    return profile
      ? privateSessionJson(profile)
      : privateSessionJson({ error: "User not found" }, { status: 404 });
  }
  return observedApiRoute(() => getCommunityUserRoute(params.identifier))(
    request,
  );
};

import { getDemoPublicUserProfile } from "@/features/demo/server/demo-public-profile";
import { privateSessionJson } from "@/lib/api/internal-session-response";
