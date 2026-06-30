import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import {
  getUserCalendarSubscription,
  getUserSectionSubscriptionState,
} from "./subscription-calendar-read-model";
import { getSubscribedSectionIds } from "./subscription-read-model-shared";
import { uniqueSectionIds } from "./subscription-section-id-helpers";
import { resolveCalendarSubscriptionSections } from "./subscription-section-resolver";

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

async function getExistingSectionIds(sectionIds: readonly number[]) {
  if (sectionIds.length === 0) {
    return [];
  }

  const sections = await prisma.section.findMany({
    where: { id: { in: uniqueSectionIds(sectionIds) } },
    select: { id: true },
  });
  return sections.map((section) => section.id);
}

async function getSectionIdByJwId(jwId: number) {
  const section = await prisma.section.findUnique({
    where: { jwId },
    select: { id: true },
  });
  return section?.id ?? null;
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

export async function hasUserSubscribedSectionByJwId(
  userId: string,
  jwId: number,
) {
  const existingSubscription = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscribedSections: {
        where: { jwId },
        select: { id: true },
      },
    },
  });
  return (existingSubscription?.subscribedSections.length ?? 0) > 0;
}

async function connectUserSectionIds(
  userId: string,
  sectionIds: readonly number[],
) {
  if (sectionIds.length === 0) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        connect: uniqueSectionIds(sectionIds).map((id) => ({ id })),
      },
    },
  });
}

async function disconnectUserSectionIds(
  userId: string,
  sectionIds: readonly number[],
) {
  const validSectionIds = await getExistingSectionIds(sectionIds);
  if (validSectionIds.length === 0) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        disconnect: validSectionIds.map((id) => ({ id })),
      },
    },
  });
}

export async function replaceUserSectionSubscriptions(
  userId: string,
  sectionIds: number[],
  locale = DEFAULT_LOCALE,
) {
  const validSectionIds = await getExistingSectionIds(sectionIds);

  await replaceUserSectionIds(userId, validSectionIds);

  return getUserCalendarSubscription(userId, locale);
}

export async function appendUserSectionSubscriptions({
  locale = DEFAULT_LOCALE,
  sectionIds,
  userId,
}: {
  locale?: AppLocale;
  sectionIds: readonly number[];
  userId: string;
}) {
  const user = await getMutableUserSubscriptions(userId);
  if (!user) {
    return null;
  }

  const currentIdSet = new Set(
    user.subscribedSections.map((section) => section.id),
  );
  const validSectionIds = await getExistingSectionIds(sectionIds);
  const addedSectionIds = validSectionIds.filter((id) => !currentIdSet.has(id));

  await connectUserSectionIds(userId, addedSectionIds);

  return {
    addedCount: addedSectionIds.length,
    alreadySubscribedCount: validSectionIds.filter((id) => currentIdSet.has(id))
      .length,
    subscription: await getUserCalendarSubscription(userId, locale),
  };
}

export async function addUserSectionSubscriptions(
  userId: string,
  sectionIds: readonly number[],
) {
  const user = await getMutableUserSubscriptions(userId);
  if (!user) {
    return null;
  }

  const existingIds = new Set(
    user.subscribedSections.map((section) => section.id),
  );
  await connectUserSectionIds(
    userId,
    sectionIds.filter((id) => !existingIds.has(id)),
  );

  return getUserSectionSubscriptionState(userId);
}

export async function importUserSectionSubscriptionsByCodes({
  codes,
  locale = DEFAULT_LOCALE,
  semesterId,
  userId,
}: {
  codes: string[];
  locale?: AppLocale;
  semesterId?: number;
  userId: string;
}) {
  const matches = await resolveCalendarSubscriptionSections({
    codes,
    locale,
    semesterId,
  });
  if (!matches) {
    return null;
  }

  const existingIds = new Set(await getSubscribedSectionIds(userId));
  const addedSections = matches.sections.filter(
    (section) => !existingIds.has(section.id),
  );
  const alreadySubscribedSections = matches.sections.filter((section) =>
    existingIds.has(section.id),
  );

  await addUserSectionSubscriptions(
    userId,
    matches.sections.map((section) => section.id),
  );

  return {
    matches,
    addedSections,
    alreadySubscribedSections,
    subscription: await getUserCalendarSubscription(userId, locale),
  };
}

export async function batchUpdateUserSectionSubscriptions({
  action,
  codes,
  locale = DEFAULT_LOCALE,
  sectionIds,
  semesterId,
  userId,
}: {
  action: "add" | "remove" | "set";
  codes?: readonly string[];
  locale?: AppLocale;
  sectionIds?: readonly number[];
  semesterId?: number;
  userId: string;
}) {
  const resolved = await resolveCalendarSubscriptionSections({
    codes,
    locale,
    sectionIds,
    semesterId,
  });
  if (!resolved) {
    return null;
  }

  const user = await getMutableUserSubscriptions(userId);
  if (!user) {
    return null;
  }

  const currentIds = user.subscribedSections.map((section) => section.id);
  const currentIdSet = new Set(currentIds);
  const targetIds = uniqueSectionIds(
    resolved.sections.map((section) => section.id),
  );
  const targetIdSet = new Set(targetIds);

  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  if (action === "add") {
    const addedIds = targetIds.filter((id) => !currentIdSet.has(id));
    addedCount = addedIds.length;
    unchangedCount = targetIds.length - addedCount;
    await connectUserSectionIds(userId, addedIds);
  } else if (action === "remove") {
    const removedIds = targetIds.filter((id) => currentIdSet.has(id));
    removedCount = removedIds.length;
    unchangedCount = targetIds.length - removedCount;
    await disconnectUserSectionIds(userId, removedIds);
  } else {
    addedCount = targetIds.filter((id) => !currentIdSet.has(id)).length;
    removedCount = currentIds.filter((id) => !targetIdSet.has(id)).length;
    unchangedCount = targetIds.length - addedCount;
    await replaceUserSectionIds(userId, targetIds);
  }

  return {
    ...resolved,
    action,
    addedCount,
    removedCount,
    unchangedCount,
    subscription: await getUserCalendarSubscription(userId, locale),
  };
}

export async function removeUserSectionSubscriptions(
  userId: string,
  sectionIds: readonly number[],
) {
  const user = await getMutableUserSubscriptions(userId);
  if (!user) {
    return null;
  }

  await disconnectUserSectionIds(userId, sectionIds);

  return getUserSectionSubscriptionState(userId);
}

export async function subscribeUserToSectionByJwId(
  userId: string,
  sectionJwId: number,
  locale = DEFAULT_LOCALE,
) {
  const sectionId = await getSectionIdByJwId(sectionJwId);
  if (sectionId === null) {
    return null;
  }

  const state = await addUserSectionSubscriptions(userId, [sectionId]);
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
  const sectionId = await getSectionIdByJwId(sectionJwId);
  if (sectionId === null) {
    return null;
  }

  const state = await removeUserSectionSubscriptions(userId, [sectionId]);
  if (!state) {
    return null;
  }

  return getUserCalendarSubscription(userId, locale);
}
