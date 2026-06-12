import { handleRouteError, jsonResponse, notFound } from "@/lib/api/helpers";
import { requireAuth } from "@/lib/auth/api-auth";

export async function getMeRoute(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    const { prisma } = await import("@/lib/db/prisma");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        username: true,
        isAdmin: true,
      },
    });

    if (!user) {
      return notFound("User not found");
    }

    return jsonResponse(user);
  } catch (error) {
    return handleRouteError("Failed to fetch user profile", error);
  }
}
