import { scheduleInvalidateUserCalendarExportCache } from "@/features/calendar/server/calendar-export-invalidation";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { acquireSectionLifecycleAdvisoryLocks } from "@/lib/db/section-lifecycle-lock";
import { getUserCalendarSubscription } from "./subscription-calendar-read-model";
import {
  subscribedSectionDetailSelect,
  subscribedSectionsFromUser,
} from "./subscription-read-model-shared";
import { uniqueSectionIds } from "./subscription-section-id-helpers";
import { resolveCalendarSubscriptionSections } from "./subscription-section-resolver";

async function getSectionIdByJwId(
  jwId: number,
  options: { includeRetired?: boolean } = {},
) {
  const section = await prisma.section.findFirst({
    where: {
      jwId,
      ...(!options.includeRetired ? { retiredAt: null } : {}),
    },
    select: { id: true },
  });
  return section?.id ?? null;
}

async function getMutableUserSubscriptions(
  userId: string,
  client: Prisma.TransactionClient,
) {
  return client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      sectionSubscriptions: {
        select: {
          section: {
            select: subscribedSectionDetailSelect,
          },
        },
      },
    },
  });
}

export async function hasUserSubscribedSectionByJwId(
  userId: string,
  jwId: number,
) {
  const existingSubscription = await withUserDbContext(userId, (tx) =>
    tx.userSectionSubscription.findFirst({
      where: {
        userId,
        section: { jwId },
      },
      select: { sectionId: true },
    }),
  );
  return existingSubscription != null;
}

async function connectUserSectionIds(
  tx: Prisma.TransactionClient,
  userId: string,
  sectionIds: readonly number[],
) {
  const ids = uniqueSectionIds(sectionIds);
  if (ids.length === 0) {
    return;
  }

  await tx.userSectionSubscription.createMany({
    data: ids.map((sectionId) => ({ userId, sectionId })),
    skipDuplicates: true,
  });
}

type LockedSectionSubscriptionMutationInput = {
  candidateSectionIds: readonly number[];
  userId: string;
};

export type LockedSectionSubscriptionMutationResult = {
  activeCandidateSectionIds: number[];
  addedSectionIds: number[];
  unchangedSectionIds: number[];
};

async function lockSubscriptionUser(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  return rows.length > 0;
}

async function lockSubscriptionSections(
  tx: Prisma.TransactionClient,
  sectionIds: readonly number[],
) {
  await acquireSectionLifecycleAdvisoryLocks(tx, sectionIds, "shared");
}

export async function mutateUserSectionSubscriptionsInTransaction(
  tx: Prisma.TransactionClient,
  input: LockedSectionSubscriptionMutationInput,
): Promise<LockedSectionSubscriptionMutationResult | null> {
  if (!(await lockSubscriptionUser(tx, input.userId))) {
    return null;
  }

  const user = await getMutableUserSubscriptions(input.userId, tx);
  if (!user) {
    return null;
  }

  const subscribedSections = subscribedSectionsFromUser(user);
  const candidateSectionIds = uniqueSectionIds(input.candidateSectionIds);
  const currentSectionIds = uniqueSectionIds(
    subscribedSections.map((section) => section.id),
  );
  const sectionIdsToLock = candidateSectionIds;

  await lockSubscriptionSections(tx, sectionIdsToLock);
  const lockedSections =
    sectionIdsToLock.length === 0
      ? []
      : await tx.section.findMany({
          where: { id: { in: sectionIdsToLock } },
          select: { id: true, retiredAt: true },
        });
  const lockedSectionById = new Map(
    lockedSections.map((section) => [section.id, section] as const),
  );
  const activeCandidateSectionIds = candidateSectionIds.filter((sectionId) => {
    const section = lockedSectionById.get(sectionId);
    return section != null && section.retiredAt == null;
  });
  const currentSectionIdSet = new Set(currentSectionIds);
  const addedSectionIds = activeCandidateSectionIds.filter(
    (sectionId) => !currentSectionIdSet.has(sectionId),
  );
  const unchangedSectionIds = activeCandidateSectionIds.filter((sectionId) =>
    currentSectionIdSet.has(sectionId),
  );

  await connectUserSectionIds(tx, input.userId, addedSectionIds);

  return {
    activeCandidateSectionIds,
    addedSectionIds,
    unchangedSectionIds,
  };
}

async function mutateUserSectionSubscriptions(
  input: LockedSectionSubscriptionMutationInput,
) {
  const result = await withUserDbContext(input.userId, (tx) =>
    mutateUserSectionSubscriptionsInTransaction(tx, input),
  );
  if (result) {
    scheduleInvalidateUserCalendarExportCache(input.userId);
  }
  return result;
}

type ResolvedCalendarSubscriptionSections = NonNullable<
  Awaited<ReturnType<typeof resolveCalendarSubscriptionSections>>
>;

function filterResolvedCalendarSubscriptionSections(
  resolved: ResolvedCalendarSubscriptionSections,
  acceptedSectionIds: readonly number[],
  requestedCodes: readonly string[] = [],
): ResolvedCalendarSubscriptionSections {
  const acceptedSectionIdSet = new Set(acceptedSectionIds);
  const sections = resolved.sections.filter((section) =>
    acceptedSectionIdSet.has(section.id),
  );
  const acceptedCodeSet = new Set(
    sections.flatMap((section) =>
      [section.code, section.course.code].map((code) =>
        code.trim().toUpperCase(),
      ),
    ),
  );
  const seenCodes = new Set<string>();
  const uniqueRequestedCodes: string[] = [];
  for (const requestedCode of requestedCodes) {
    const code = requestedCode.trim();
    const normalized = code.toUpperCase();
    if (!code || seenCodes.has(normalized)) continue;
    seenCodes.add(normalized);
    uniqueRequestedCodes.push(code);
  }

  return {
    ...resolved,
    matchedCodes: uniqueRequestedCodes.filter((code) =>
      acceptedCodeSet.has(code.toUpperCase()),
    ),
    unmatchedCodes: uniqueRequestedCodes.filter(
      (code) => !acceptedCodeSet.has(code.toUpperCase()),
    ),
    sections,
    total: sections.length,
  };
}

type RemovedUserSectionSubscriptions = {
  removedCount: number;
  unchangedCount: number;
};

async function removeUserSectionIdsInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  sectionIds: readonly number[],
): Promise<RemovedUserSectionSubscriptions | null> {
  if (!(await lockSubscriptionUser(tx, userId))) {
    return null;
  }

  const targetIds = uniqueSectionIds(sectionIds);
  await lockSubscriptionSections(tx, targetIds);

  const deleted =
    targetIds.length === 0
      ? { count: 0 }
      : await tx.userSectionSubscription.deleteMany({
          where: {
            userId,
            sectionId: { in: targetIds },
          },
        });

  return {
    removedCount: deleted.count,
    unchangedCount: targetIds.length - deleted.count,
  };
}

async function removeUserSectionIds(
  userId: string,
  sectionIds: readonly number[],
) {
  return withUserDbContext(userId, (tx) =>
    removeUserSectionIdsInTransaction(tx, userId, sectionIds),
  );
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
  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: sectionIds,
    userId,
  });
  if (!mutation) {
    return null;
  }

  return {
    addedCount: mutation.addedSectionIds.length,
    alreadySubscribedCount: mutation.unchangedSectionIds.length,
    subscription: await getUserCalendarSubscription(userId, locale),
  };
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

  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: matches.sections.map((section) => section.id),
    userId,
  });
  if (!mutation) {
    return null;
  }
  const acceptedMatches = filterResolvedCalendarSubscriptionSections(
    matches,
    mutation.activeCandidateSectionIds,
    codes,
  );
  const addedSectionIdSet = new Set(mutation.addedSectionIds);
  const unchangedSectionIdSet = new Set(mutation.unchangedSectionIds);
  const addedSections = acceptedMatches.sections.filter((section) =>
    addedSectionIdSet.has(section.id),
  );
  const alreadySubscribedSections = acceptedMatches.sections.filter((section) =>
    unchangedSectionIdSet.has(section.id),
  );

  return {
    matches: acceptedMatches,
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
  action: "add" | "remove";
  codes?: readonly string[];
  locale?: AppLocale;
  sectionIds?: readonly number[];
  semesterId?: number;
  userId: string;
}) {
  const resolved = await resolveCalendarSubscriptionSections({
    codes,
    includeRetired: action === "remove",
    locale,
    sectionIds,
    semesterId,
  });
  if (!resolved) {
    return null;
  }

  const targetIds = uniqueSectionIds(
    resolved.sections.map((section) => section.id),
  );

  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;
  let acceptedTargetIds = targetIds;
  let responseResolved = resolved;
  let responseSections = resolved.sections;
  let responseTotal = resolved.total;

  if (action === "add") {
    const mutation = await mutateUserSectionSubscriptions({
      candidateSectionIds: targetIds,
      userId,
    });
    if (!mutation) return null;
    acceptedTargetIds = mutation.activeCandidateSectionIds;
    addedCount = mutation.addedSectionIds.length;
    unchangedCount = mutation.unchangedSectionIds.length;
    responseResolved = filterResolvedCalendarSubscriptionSections(
      resolved,
      acceptedTargetIds,
      codes ?? [],
    );
    responseSections = responseResolved.sections;
    responseTotal = responseSections.length;
  } else if (action === "remove") {
    const mutation = await removeUserSectionIds(userId, targetIds);
    if (!mutation) return null;
    removedCount = mutation.removedCount;
    unchangedCount = mutation.unchangedCount;
  }

  const acceptedTargetIdSet = new Set(acceptedTargetIds);
  const acceptedRequestedIdSet = new Set([
    ...resolved.matchedSectionIds.filter((sectionId) =>
      acceptedTargetIdSet.has(sectionId),
    ),
  ]);
  const requestedSectionIds = uniqueSectionIds(sectionIds ?? []);
  return {
    ...responseResolved,
    matchedSectionIds: requestedSectionIds.filter((id) =>
      acceptedRequestedIdSet.has(id),
    ),
    unmatchedSectionIds: requestedSectionIds.filter(
      (id) => !acceptedRequestedIdSet.has(id),
    ),
    sections: responseSections,
    total: responseTotal,
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
  return (await removeUserSectionIds(userId, sectionIds)) ? true : null;
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

  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: [sectionId],
    userId,
  });
  if (!mutation?.activeCandidateSectionIds.includes(sectionId)) {
    return null;
  }

  return getUserCalendarSubscription(userId, locale);
}

export async function unsubscribeUserFromSectionByJwId(
  userId: string,
  sectionJwId: number,
  locale = DEFAULT_LOCALE,
) {
  const sectionId = await getSectionIdByJwId(sectionJwId, {
    includeRetired: true,
  });
  if (sectionId === null) {
    return null;
  }

  const state = await removeUserSectionSubscriptions(userId, [sectionId]);
  if (!state) {
    return null;
  }

  return getUserCalendarSubscription(userId, locale);
}

export async function setUserSectionSubscriptionByJwId(input: {
  sectionJwId: number;
  subscribed: boolean;
  userId: string;
}) {
  const sectionId = await getSectionIdByJwId(input.sectionJwId, {
    includeRetired: !input.subscribed,
  });
  if (sectionId === null) return null;

  if (input.subscribed) {
    const mutation = await mutateUserSectionSubscriptions({
      candidateSectionIds: [sectionId],
      userId: input.userId,
    });
    if (!mutation?.activeCandidateSectionIds.includes(sectionId)) {
      return null;
    }
    return {
      sectionJwId: input.sectionJwId,
      subscribed: true,
    };
  }

  await withUserDbContext(input.userId, (tx) =>
    tx.userSectionSubscription.deleteMany({
      where: {
        userId: input.userId,
        sectionId,
      },
    }),
  );

  return {
    sectionJwId: input.sectionJwId,
    subscribed: false,
  };
}
