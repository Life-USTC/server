import { sectionCompactInclude } from "@/features/catalog/server/academic-query-includes";
import { toSectionCompactDto } from "@/features/catalog/server/academic-summary-dto-mappers";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { withUserDbContext } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
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
  const user = await withUserDbContext(userId, (tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: userSectionSubscriptionSelect,
    }),
  );
  if (!user) return null;

  return {
    userId: user.id,
    subscriptionIcsUrl: await buildCalendarFeedPath(
      user.id,
      user.calendarFeedToken,
    ),
    subscribedSections: user.sectionSubscriptions.map(
      ({ section }) => section.id,
    ),
  };
}

export async function getUserSectionSubscriptionStateForSection(
  userId: string,
  sectionJwId: number,
) {
  const user = await withUserDbContext(userId, (tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        calendarFeedToken: true,
        sectionSubscriptions: {
          where: { section: { jwId: sectionJwId } },
          select: { sectionId: true },
          take: 1,
        },
      },
    }),
  );
  if (!user) return null;

  return {
    userId: user.id,
    subscriptionIcsUrl: await buildCalendarFeedPath(
      user.id,
      user.calendarFeedToken,
    ),
    isSubscribed: user.sectionSubscriptions.length > 0,
  };
}

export async function getUserCalendarSubscription(
  userId: string,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const user = await withUserDbContext(userId, (tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        calendarFeedToken: true,
        sectionSubscriptions: {
          include: {
            section: {
              include: sectionCompactInclude,
            },
          },
          orderBy: [
            { section: { semester: { jwId: "desc" } } },
            { section: { code: "asc" } },
          ],
        },
      },
    }),
  );

  if (!user) return null;

  const calendarPath = await buildCalendarFeedPath(
    user.id,
    user.calendarFeedToken,
  );
  return {
    userId: user.id,
    sections: user.sectionSubscriptions.map((row) =>
      toSectionCompactDto(row.section, locale),
    ),
    calendarPath,
    calendarUrl: `${getPublicOrigin()}${calendarPath}`,
    note: SECTION_SUBSCRIPTION_NOTE,
  };
}

export async function getCalendarSubscriptionUrl(
  userId: string,
  calendarFeedToken?: string | null,
) {
  try {
    // Callers must explicitly prove a recent session before passing the token.
    // Undefined means the secret is intentionally hidden, not "load it here".
    if (calendarFeedToken === undefined) return null;
    return await buildCalendarFeedPath(userId, calendarFeedToken);
  } catch (error) {
    // Token minting can fail on missing column grants; empty subscription SSR
    // should still render instead of 500ing the whole workspace tab.
    logAppEvent(
      "warn",
      "calendar.subscription-url.failed",
      {
        event: "calendar.subscription-url.failed",
        source: "subscriptions",
      },
      error,
    );
    return null;
  }
}
