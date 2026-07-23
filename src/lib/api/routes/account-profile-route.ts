import { findAuthenticatedUserProfileById } from "@/features/profile/server/profile-read-model";
import { handleRouteError, jsonResponse, notFound } from "@/lib/api/helpers";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getAccountProfileRoute(request: Request) {
  try {
    const auth = await requireAuth(request, {
      bearerScope: { feature: "account.profile", action: "read" },
    });
    if (auth instanceof Response) return auth;

    const user = await findAuthenticatedUserProfileById(auth.userId);
    return user ? jsonResponse(user) : notFound("User not found");
  } catch (error) {
    return handleRouteError("Failed to fetch account profile", error);
  }
}
