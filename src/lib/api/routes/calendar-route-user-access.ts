import { authorizeUserCalendarFeed } from "@/features/calendar/server/calendar-feed-access";
import { forbidden, gone, notFound, unauthorized } from "@/lib/api/helpers";
import { resolveSessionUserId } from "@/lib/auth/api-auth";

export async function resolveUserCalendarAccess({
  rawUserId,
  request,
}: {
  rawUserId: string;
  request: Request;
}) {
  const decision = await authorizeUserCalendarFeed({
    queryToken: new URL(request.url).searchParams.get("token"),
    rawUserId,
    resolveViewerUserId: () => resolveSessionUserId(request),
  });
  if (decision.ok) return { ok: true as const, userId: decision.userId };

  switch (decision.reason) {
    case "token_revoked":
      return {
        ok: false as const,
        response: gone("Calendar feed token revoked"),
      };
    case "unauthenticated":
      return { ok: false as const, response: unauthorized() };
    case "forbidden":
      return {
        ok: false as const,
        response: forbidden("You can only access your own calendar"),
      };
    case "not_found":
      return { ok: false as const, response: notFound("User not found") };
  }
}
