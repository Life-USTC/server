import type { RequestHandler } from "@sveltejs/kit";
import { getPublicProfileAvatar } from "@/features/profile/server/profile-avatar-service";
import { handleRouteError, notFound } from "@/lib/api/helpers";

export const GET: RequestHandler = async ({ params }) => {
  try {
    const response = await getPublicProfileAvatar({
      avatarId: params.avatarId,
      userId: params.userId,
    });
    return response ?? notFound();
  } catch (error) {
    return handleRouteError("Failed to load profile avatar", error);
  }
};
