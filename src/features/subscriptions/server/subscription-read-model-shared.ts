import type { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  buildUserCalendarFeedPath,
  ensureUserCalendarFeedToken,
} from "./calendar-feed-token";

export const SECTION_SUBSCRIPTION_NOTE =
  "Life@USTC section subscriptions only affect your workspace and calendar here. They are not official USTC course enrollment.";

export const subscribedSectionDetailSelect = {
  id: true,
  jwId: true,
  semesterId: true,
  retiredAt: true,
} satisfies Prisma.SectionSelect;

export type SubscribedSectionDetail = Prisma.SectionGetPayload<{
  select: typeof subscribedSectionDetailSelect;
}>;

export function subscribedSectionsFromUser(
  user:
    | {
        sectionSubscriptions: Array<{ section: SubscribedSectionDetail }>;
      }
    | null
    | undefined,
): SubscribedSectionDetail[] {
  return user?.sectionSubscriptions.map((row) => row.section) ?? [];
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
  const rows = await withUserDbContext(userId, (tx) =>
    tx.userSectionSubscription.findMany({
      where: { userId },
      select: { sectionId: true },
    }),
  );
  return rows.map((row) => row.sectionId);
}

export async function getActiveSubscribedSectionIds(
  userId: string,
  sectionIds?: readonly number[],
): Promise<number[]> {
  const rows = await withUserDbContext(userId, (tx) =>
    tx.userSectionSubscription.findMany({
      where: {
        userId,
        section: {
          retiredAt: null,
          ...(sectionIds ? { id: { in: Array.from(sectionIds) } } : {}),
        },
      },
      select: { sectionId: true },
    }),
  );
  return rows.map((row) => row.sectionId);
}

export async function getSubscribedSectionIdsForSemester(
  userId: string,
  semesterId: number,
): Promise<number[]> {
  const rows = await withUserDbContext(userId, (tx) =>
    tx.userSectionSubscription.findMany({
      where: {
        userId,
        section: { semesterId },
      },
      select: { sectionId: true },
    }),
  );
  return rows.map((row) => row.sectionId);
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
