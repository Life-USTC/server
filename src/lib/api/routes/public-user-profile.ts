import {
  getUserProfileById,
  getUserProfileByUsername,
} from "@/features/profile/server/user-profile-page-data";
import { handleRouteError, jsonResponse, notFound } from "@/lib/api/helpers";

export async function getCommunityUserRoute(identifier: string) {
  try {
    const normalized = identifier.trim();
    const profile = normalized
      ? ((await getUserProfileByUsername(normalized.toLowerCase())) ??
        (await getUserProfileById(normalized)))
      : null;

    if (!profile) return notFound("User not found");

    return jsonResponse(profile);
  } catch (error) {
    return handleRouteError("Failed to fetch public user profile", error);
  }
}
