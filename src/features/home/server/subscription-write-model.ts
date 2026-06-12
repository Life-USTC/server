import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import {
  getUserCalendarSubscription,
  getUserSectionSubscriptionState,
} from "./subscription-read-model";
import {
  mergeSectionIds,
  removeSectionIds,
  uniqueSectionIds,
} from "./subscription-section-id-helpers";

async function replaceUserSectionIds(
  userId: string,
  nextIds: readonly number[],
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        set: uniqueSectionIds(nextIds).map((id) => ({ id })),
      },
    },
  });
}

async function getMutableUserSubscriptions(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscribedSections: {
        select: { id: true, jwId: true },
      },
    },
  });
}

export async function replaceUserSectionSubscriptions(
  userId: string,
  sectionIds: number[],
  locale = DEFAULT_LOCALE,
) {
  const existingSections = await prisma.section.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true },
  });
  const validSectionIds = existingSections.map((section) => section.id);

  await replaceUserSectionIds(userId, validSectionIds);

  return getUserCalendarSubscription(userId, locale);
}

export async function addUserSectionSubscriptions(
  userId: string,
  sectionIds: readonly number[],
) {
  const user = await getMutableUserSubscriptions(userId);
  if (!user) {
    return null;
  }

  await replaceUserSectionIds(
    userId,
    mergeSectionIds(
      user.subscribedSections.map((section) => section.id),
      sectionIds,
    ),
  );

  return getUserSectionSubscriptionState(userId);
}

export async function removeUserSectionSubscriptions(
  userId: string,
  sectionIds: readonly number[],
) {
  const user = await getMutableUserSubscriptions(userId);
  if (!user) {
    return null;
  }

  await replaceUserSectionIds(
    userId,
    removeSectionIds(
      user.subscribedSections.map((section) => section.id),
      sectionIds,
    ),
  );

  return getUserSectionSubscriptionState(userId);
}

export async function subscribeUserToSectionByJwId(
  userId: string,
  sectionJwId: number,
  locale = DEFAULT_LOCALE,
) {
  const section = await prisma.section.findUnique({
    where: { jwId: sectionJwId },
    select: { id: true },
  });
  if (!section) {
    return null;
  }

  const state = await addUserSectionSubscriptions(userId, [section.id]);
  if (!state) {
    return null;
  }

  return getUserCalendarSubscription(userId, locale);
}

export async function unsubscribeUserFromSectionByJwId(
  userId: string,
  sectionJwId: number,
  locale = DEFAULT_LOCALE,
) {
  const user = await getMutableUserSubscriptions(userId);
  if (!user) {
    return null;
  }

  await replaceUserSectionIds(
    userId,
    user.subscribedSections
      .filter((section) => section.jwId !== sectionJwId)
      .map((section) => section.id),
  );

  return getUserCalendarSubscription(userId, locale);
}
