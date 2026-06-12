import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { sectionCompactInclude } from "@/lib/query-helpers";
import { getPublicOrigin } from "@/lib/site-url";
import {
  buildCalendarFeedPath,
  SECTION_SUBSCRIPTION_NOTE,
  type UserSectionSubscriptionState,
  userSectionSubscriptionSelect,
} from "./subscription-read-model-shared";

export async function getUserSectionSubscriptionState(
  userId: string,
): Promise<UserSectionSubscriptionState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSectionSubscriptionSelect,
  });
  if (!user) return null;

  return {
    userId: user.id,
    subscriptionIcsUrl: await buildCalendarFeedPath(
      user.id,
      user.calendarFeedToken,
    ),
    subscribedSections: user.subscribedSections.map(({ id }) => id),
  };
}

export async function getUserCalendarSubscription(
  userId: string,
  locale = DEFAULT_LOCALE,
) {
  const localizedPrisma = getPrisma(locale);
  const user = await localizedPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      calendarFeedToken: true,
      subscribedSections: {
        include: sectionCompactInclude,
        orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
      },
    },
  });

  if (!user) return null;

  const calendarPath = await buildCalendarFeedPath(
    user.id,
    user.calendarFeedToken,
  );
  return {
    userId: user.id,
    sections: user.subscribedSections,
    calendarPath,
    calendarUrl: `${getPublicOrigin()}${calendarPath}`,
    note: SECTION_SUBSCRIPTION_NOTE,
  };
}

export async function getCalendarSubscriptionUrl(
  userId: string,
  calendarFeedToken?: string | null,
) {
  if (calendarFeedToken !== undefined) {
    return buildCalendarFeedPath(userId, calendarFeedToken);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, calendarFeedToken: true },
  });
  if (!user) return null;
  return buildCalendarFeedPath(user.id, user.calendarFeedToken);
}
