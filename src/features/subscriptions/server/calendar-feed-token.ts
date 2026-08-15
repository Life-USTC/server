import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { resolveAuthoritativeRecentSession } from "@/lib/auth/recent-session";
import { randomBytesBase64Url } from "@/lib/crypto/web-crypto";
import { prisma } from "@/lib/db/prisma";

function createCalendarFeedToken(): string {
  return randomBytesBase64Url(24);
}

async function auditCalendarFeedTokenCreation(userId: string) {
  await fireAuditLog({
    action: "account_calendar_token_create",
    channel: "system",
    subjectUserId: userId,
    targetId: userId,
    targetType: "calendar_feed",
    userId,
  });
}

export async function ensureUserCalendarFeedToken(
  userId: string,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarFeedToken: true },
  });

  if (existing?.calendarFeedToken) {
    return existing.calendarFeedToken;
  }

  const token = createCalendarFeedToken();
  const updateResult = await prisma.user.updateMany({
    where: { id: userId, calendarFeedToken: null },
    data: { calendarFeedToken: token },
  });

  if (updateResult.count === 1) {
    await auditCalendarFeedTokenCreation(userId);
    return token;
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarFeedToken: true },
  });

  if (current?.calendarFeedToken) {
    return current.calendarFeedToken;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { calendarFeedToken: token },
  });

  await auditCalendarFeedTokenCreation(userId);

  return token;
}

export type RotateUserCalendarFeedTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: "session_not_fresh" | "unauthenticated" };

export async function rotateUserCalendarFeedToken(
  userId: string,
  headers: Headers,
): Promise<RotateUserCalendarFeedTokenResult> {
  const recent = await resolveAuthoritativeRecentSession(headers, {
    expectedUserId: userId,
  });
  if (!recent.ok) {
    await fireAuditLog({
      action: "account_calendar_token_rotate",
      channel: "web",
      outcome: "denied",
      subjectUserId: userId,
      targetId: userId,
      targetType: "calendar_feed",
      userId,
      ...(recent.sessionId ? { sessionId: recent.sessionId } : {}),
      metadata: { reason: recent.reason },
      ...getAuditRequestMetadata({ headers }),
    });
    return recent;
  }

  const token = createCalendarFeedToken();
  await prisma.user.update({
    where: { id: userId },
    data: { calendarFeedToken: token },
  });
  await fireAuditLog({
    action: "account_calendar_token_rotate",
    channel: "web",
    sessionId: recent.sessionId,
    subjectUserId: userId,
    targetId: userId,
    targetType: "calendar_feed",
    userId,
    ...getAuditRequestMetadata({ headers }),
  });
  return { ok: true, token };
}

export function buildUserCalendarFeedPath(
  userId: string,
  token: string,
): string {
  return `/api/calendar-feeds/${userId}:${token}.ics`;
}
