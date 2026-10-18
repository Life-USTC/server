/**
 * Access rules for the personal calendar feed (`/api/calendar-feeds/<id>.ics`).
 * Transports map the decision to HTTP; the rules live here so they stay shared.
 */
import { getUserCalendarAccessRecord } from "@/features/calendar/server/calendar-export-data";

export type UserCalendarAccessDenial =
  | "forbidden"
  | "not_found"
  | "token_revoked"
  | "unauthenticated";

export type UserCalendarAccessDecision =
  | { ok: true; userId: string }
  | { ok: false; reason: UserCalendarAccessDenial };

/** Feed identifiers are `<userId>` or `<userId>:<token>` (token embedded in the path). */
export function parseUserCalendarIdentifier(rawUserId: string) {
  const separatorIndex = rawUserId.indexOf(":");
  if (separatorIndex === -1) {
    return {
      userId: rawUserId,
      tokenFromPath: null,
    };
  }

  return {
    userId: rawUserId.slice(0, separatorIndex),
    tokenFromPath: rawUserId.slice(separatorIndex + 1),
  };
}

/**
 * A feed token (path or query) is the sole credential and never consults the
 * session. Without a token the signed-in viewer must be the feed owner.
 */
export async function authorizeUserCalendarFeed(input: {
  queryToken?: string | null;
  rawUserId: string;
  resolveViewerUserId: () => Promise<string | null>;
}): Promise<UserCalendarAccessDecision> {
  const { userId, tokenFromPath } = parseUserCalendarIdentifier(
    input.rawUserId,
  );
  const token = tokenFromPath?.trim() || input.queryToken?.trim();

  const user = await getUserCalendarAccessRecord(userId);

  if (token) {
    if (!user) return { ok: false, reason: "not_found" };
    if (user.calendarFeedToken !== token) {
      return { ok: false, reason: "token_revoked" };
    }
    return { ok: true, userId };
  }

  const viewerUserId = await input.resolveViewerUserId();
  if (!viewerUserId) return { ok: false, reason: "unauthenticated" };
  if (viewerUserId !== userId) return { ok: false, reason: "forbidden" };
  if (!user) return { ok: false, reason: "not_found" };

  return { ok: true, userId };
}
