import { forbidden, notFound, unauthorized } from "@/lib/api/helpers";
import { resolveApiUserId } from "@/lib/auth/api-auth";
import { getUserCalendarRecord } from "./calendar-route-data";
import { parseUserCalendarIdentifier } from "./calendar-route-utils";

export async function resolveUserCalendarAccess({
  rawUserId,
  request,
}: {
  rawUserId: string;
  request: Request;
}) {
  const { userId, tokenFromPath } = parseUserCalendarIdentifier(rawUserId);
  const token =
    tokenFromPath?.trim() ||
    new URL(request.url).searchParams.get("token")?.trim();

  const user = await getUserCalendarRecord(userId);

  if (token) {
    if (!user || user.calendarFeedToken !== token) {
      return {
        ok: false as const,
        response: forbidden("Invalid or unauthorized token"),
      };
    }
  } else {
    const viewerUserId = await resolveApiUserId(request);
    if (!viewerUserId) {
      return { ok: false as const, response: unauthorized() };
    }

    if (viewerUserId !== userId) {
      return {
        ok: false as const,
        response: forbidden("You can only access your own calendar"),
      };
    }

    if (!user) {
      return { ok: false as const, response: notFound("User not found") };
    }
  }

  if (!user) {
    return { ok: false as const, response: notFound("User not found") };
  }

  return { ok: true as const, user, userId };
}
