import { randomBytesBase64Url } from "@/lib/crypto/web-crypto";
import { prisma } from "@/lib/db/prisma";

function createCalendarFeedToken(): string {
  return randomBytesBase64Url(24);
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

  return token;
}

export function buildUserCalendarFeedPath(
  userId: string,
  token: string,
): string {
  return `/api/calendar-feeds/${userId}:${token}.ics`;
}
