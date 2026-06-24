import {
  getUserProfileById,
  getUserProfileByUsername,
} from "@/features/profile/server/user-profile-page-data";
import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { publicUserProfileQuerySchema } from "@/lib/api/schemas/request-schemas";

export async function getPublicUserProfileRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = parseRouteSearchParams(
    searchParams,
    publicUserProfileQuerySchema,
    "Invalid public profile query",
  );
  if (query instanceof Response) return query;

  try {
    const profile = query.username
      ? await getUserProfileByUsername(query.username)
      : query.userId
        ? await getUserProfileById(query.userId)
        : null;

    if (!profile) return notFound("User not found");

    return jsonResponse(profile);
  } catch (error) {
    return handleRouteError("Failed to fetch public user profile", error);
  }
}
