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
  return `/api/users/${userId}:${token}/calendar.ics`;
}
