import { selectCurrentSemesterFromList } from "@/features/catalog/lib/current-semester";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import { getCalendarSubscriptionUrl } from "./subscription-calendar-read-model";
import { getUserSubscriptionKinds } from "./subscription-kind";
import {
  listSubscribedSectionsForSubscriptionsTab,
  subscriptionSectionFromRow,
} from "./subscription-tab-sections";

export async function getSubscriptionsTabData(
  userId: string,
  locale = DEFAULT_LOCALE,
  options: {
    calendarFeedToken?: string | null;
    includeExams?: boolean;
    sectionIds?: readonly number[];
  } = {},
) {
  const localizedPrisma = getPrisma(locale);
  const kinds = await getUserSubscriptionKinds(userId);
  const sectionIds = options.sectionIds?.filter((id) => kinds.has(id)) ?? [
    ...kinds.keys(),
  ];
  const [sections, semesters, calendarSubscriptionUrl] = await Promise.all([
    listSubscribedSectionsForSubscriptionsTab(userId, locale, {
      includeExams: options.includeExams,
      sectionIds,
    }),
    localizedPrisma.semester.findMany({
      select: { id: true, nameCn: true, startDate: true, endDate: true },
      orderBy: { startDate: "asc" },
    }),
    getCalendarSubscriptionUrl(userId, options.calendarFeedToken),
  ]);

  return {
    subscriptions:
      sections.length > 0
        ? [
            {
              id: userId,
              sections: sections.flatMap((row) => {
                const kind = kinds.get(row.id);
                return kind === undefined
                  ? []
                  : [{ ...subscriptionSectionFromRow(row), kind }];
              }),
            },
          ]
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
