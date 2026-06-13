import { DEFAULT_LOCALE } from "@/i18n/config";
import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import { getPrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { getCalendarSubscriptionUrl } from "./subscription-calendar-read-model";
import {
  listSubscribedSectionsForSubscriptionsTab,
  subscriptionSectionFromRow,
} from "./subscription-tab-sections";

export async function getSubscriptionsTabData(
  userId: string,
  locale = DEFAULT_LOCALE,
  options: { includeExams?: boolean; sectionIds?: readonly number[] } = {},
) {
  const localizedPrisma = getPrisma(locale);
  const [sections, semesters, calendarSubscriptionUrl] = await Promise.all([
    listSubscribedSectionsForSubscriptionsTab(userId, locale, {
      includeExams: options.includeExams,
      sectionIds: options.sectionIds,
    }),
    localizedPrisma.semester.findMany({
      select: { id: true, nameCn: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
    getCalendarSubscriptionUrl(userId),
  ]);

  return {
    subscriptions:
      sections.length > 0
        ? [{ id: userId, sections: sections.map(subscriptionSectionFromRow) }]
        : [],
    semesters: semesters.map((semester) => ({
      id: semester.id,
      nameCn: semester.nameCn,
      startDate: semester.startDate
        ? toShanghaiIsoString(semester.startDate)
        : null,
      endDate: semester.endDate ? toShanghaiIsoString(semester.endDate) : null,
    })),
    currentSemesterId:
      selectCurrentSemesterFromList(semesters, new Date())?.id ?? null,
    userId,
    calendarSubscriptionUrl,
  };
}

export type SubscriptionsTabData = Awaited<
  ReturnType<typeof getSubscriptionsTabData>
>;
