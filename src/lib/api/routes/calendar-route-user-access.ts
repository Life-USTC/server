import { getUserCalendarAccessRecord } from "@/features/calendar/server/calendar-export-data";
import { forbidden, gone, notFound, unauthorized } from "@/lib/api/helpers";
import { resolveSessionUserId } from "@/lib/auth/api-auth";
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

  const user = await getUserCalendarAccessRecord(userId);

  if (token) {
    if (!user) {
      return { ok: false as const, response: notFound("User not found") };
    }
    if (user.calendarFeedToken !== token) {
      return {
        ok: false as const,
        response: gone("Calendar feed token revoked"),
      };
    }
  } else {
    const viewerUserId = await resolveSessionUserId(request);
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

  return { ok: true as const, userId };
}
