import { projectAuthenticatedUserProfile } from "@/features/profile/lib/account-profile-projection";
import { findAuthenticatedUserProfileById } from "@/features/profile/server/profile-read-model";
import {
  handleRouteError,
  jsonResponse,
  notFound,
  unauthorized,
} from "@/lib/api/helpers";
import { resolveApiPrincipal } from "@/lib/auth/api-auth";
import { OAUTH_EMAIL_SCOPE } from "@/lib/oauth/constants";

export async function getAccountProfileRoute(request: Request) {
  try {
    const principal = await resolveApiPrincipal(request, {
      bearerScope: { feature: "account.profile", action: "read" },
    });
    if (!principal) return unauthorized();

    const user = await findAuthenticatedUserProfileById(principal.userId);
    return user
      ? jsonResponse(
          projectAuthenticatedUserProfile(user, {
            email:
              principal.kind === "session" ||
              principal.scopes.has(OAUTH_EMAIL_SCOPE),
            adminStatus: principal.kind === "session",
          }),
        )
      : notFound("User not found");
  } catch (error) {
    return handleRouteError("Failed to fetch account profile", error);
  }
}
