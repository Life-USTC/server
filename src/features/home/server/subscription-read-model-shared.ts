import type { Prisma } from "@/generated/prisma/client";
import {
  buildUserCalendarFeedPath,
  ensureUserCalendarFeedToken,
} from "@/lib/calendar-feed-token";
import { prisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export const SECTION_SUBSCRIPTION_NOTE =
  "Life@USTC section subscriptions only affect your dashboard and calendar here. They are not official USTC course enrollment.";

export const userSectionSubscriptionSelect = {
  id: true,
  calendarFeedToken: true,
  subscribedSections: { select: { id: true, jwId: true } },
} satisfies Prisma.UserSelect;

export interface UserSectionSubscriptionState {
  userId: string;
  subscriptionIcsUrl: string;
  subscribedSections: number[];
}

export type SectionOption = {
  id: number;
  jwId: number | null;
  code: string | null;
  courseName: string | null;
  semesterName: string | null;
  semesterStart: string | null;
  semesterEnd: string | null;
};

export async function getSubscribedSectionIds(
  userId: string,
): Promise<number[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscribedSections: { select: { id: true } } },
  });
  return user?.subscribedSections.map((s) => s.id) ?? [];
}

export async function resolveSubscribedSectionIds(
  userId: string,
  sectionIds?: readonly number[],
) {
  return sectionIds
    ? Array.from(sectionIds)
    : await getSubscribedSectionIds(userId);
}

export async function withSubscribedSections<T>(
  userId: string,
  fn: (ids: number[]) => Promise<T>,
  sectionIds?: readonly number[],
  fallback: T = [] as T,
): Promise<T> {
  const ids = await resolveSubscribedSectionIds(userId, sectionIds);
  if (ids.length === 0) return fallback;
  return fn(ids);
}

export async function buildCalendarFeedPath(
  userId: string,
  calendarFeedToken: string | null,
) {
  const token =
    calendarFeedToken ?? (await ensureUserCalendarFeedToken(userId));
  return buildUserCalendarFeedPath(userId, token);
}

export function sectionOptionFromRow(row: {
  id: number;
  jwId: number | null;
  code: string | null;
  course: { namePrimary: string | null } | null;
  semester: {
    nameCn: string | null;
    startDate: Date | null;
    endDate: Date | null;
  } | null;
}) {
  return {
    id: row.id,
    jwId: row.jwId,
    code: row.code,
    courseName: row.course?.namePrimary ?? null,
    semesterName: row.semester?.nameCn ?? null,
    semesterStart: row.semester?.startDate
      ? toShanghaiIsoString(row.semester.startDate)
      : null,
    semesterEnd: row.semester?.endDate
      ? toShanghaiIsoString(row.semester.endDate)
      : null,
  };
}

export function groupByField<T, K extends string, V>(
  items: T[],
  field: K,
  mapFn: (item: T) => V,
): Map<number, V[]> {
  const map = new Map<number, V[]>();
  for (const item of items) {
    const key = (item as Record<string, unknown>)[field] as number;
    const list = map.get(key) ?? [];
    list.push(mapFn(item));
    map.set(key, list);
  }
  return map;
}
