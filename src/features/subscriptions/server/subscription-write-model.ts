import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { prisma } from "@/lib/db/prisma";
import { acquireSectionLifecycleAdvisoryLocks } from "@/lib/db/section-lifecycle-lock";
import {
  getUserCalendarSubscription,
  getUserSectionSubscriptionState,
} from "./subscription-calendar-read-model";
import { uniqueSectionIds } from "./subscription-section-id-helpers";
import { resolveCalendarSubscriptionSections } from "./subscription-section-resolver";

async function replaceUserSectionIds(
  tx: Prisma.TransactionClient,
  userId: string,
  nextIds: readonly number[],
) {
  await tx.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        set: uniqueSectionIds(nextIds).map((id) => ({ id })),
      },
    },
  });
}

async function replaceUserSectionIdsInSemester(
  tx: Prisma.TransactionClient,
  userId: string,
  currentIds: readonly number[],
  nextIds: readonly number[],
) {
  const currentIdSet = new Set(currentIds);
  const nextIdSet = new Set(nextIds);
  await tx.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        connect: uniqueSectionIds(nextIds)
          .filter((id) => !currentIdSet.has(id))
          .map((id) => ({ id })),
        disconnect: uniqueSectionIds(currentIds)
          .filter((id) => !nextIdSet.has(id))
          .map((id) => ({ id })),
      },
    },
  });
}

async function getExistingSectionIds(
  sectionIds: readonly number[],
  options: { includeRetired?: boolean } = {},
) {
  if (sectionIds.length === 0) {
    return [];
  }

  const sections = await prisma.section.findMany({
    where: {
      id: { in: uniqueSectionIds(sectionIds) },
      ...(!options.includeRetired ? { retiredAt: null } : {}),
    },
    select: { id: true },
  });
  return sections.map((section) => section.id);
}

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
  client: Prisma.TransactionClient = prisma,
) {
  return client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscribedSections: {
        select: { id: true, jwId: true, semesterId: true, retiredAt: true },
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
  tx: Prisma.TransactionClient,
  userId: string,
  sectionIds: readonly number[],
) {
  if (sectionIds.length === 0) {
    return;
  }

  await tx.user.update({
    where: { id: userId },
    data: {
      subscribedSections: {
        connect: uniqueSectionIds(sectionIds).map((id) => ({ id })),
      },
    },
  });
}

type LockedSectionSubscriptionMutationInput = {
  candidateSectionIds: readonly number[];
  mode: "connect" | "replace";
  preserveRetiredSectionIds?: readonly number[];
  semesterId?: number;
  userId: string;
};

export type LockedSectionSubscriptionMutationResult = {
  activeCandidateSectionIds: number[];
  addedSectionIds: number[];
  effectiveSectionIds: number[];
  preservedRetiredSectionIds: number[];
  removedSectionIds: number[];
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

  const candidateSectionIds = uniqueSectionIds(input.candidateSectionIds);
  const currentSectionIds = uniqueSectionIds(
    user.subscribedSections.map((section) => section.id),
  );
  const preserveRetiredSectionIds = uniqueSectionIds(
    input.preserveRetiredSectionIds ?? [],
  );
  const sectionIdsToLock =
    input.mode === "replace"
      ? uniqueSectionIds([
          ...candidateSectionIds,
          ...currentSectionIds,
          ...preserveRetiredSectionIds,
        ])
      : candidateSectionIds;

  await lockSubscriptionSections(tx, sectionIdsToLock);
  const lockedSections =
    sectionIdsToLock.length === 0
      ? []
      : await tx.section.findMany({
          where: { id: { in: sectionIdsToLock } },
          select: { id: true, retiredAt: true, semesterId: true },
        });
  const lockedSectionById = new Map(
    lockedSections.map((section) => [section.id, section] as const),
  );
  const inScope = (sectionId: number) => {
    const section = lockedSectionById.get(sectionId);
    return (
      section != null &&
      (input.semesterId === undefined ||
        section.semesterId === input.semesterId)
    );
  };
  const activeCandidateSectionIds = candidateSectionIds.filter((sectionId) => {
    const section = lockedSectionById.get(sectionId);
    return section?.retiredAt == null && inScope(sectionId);
  });
  const currentSectionIdSet = new Set(currentSectionIds);
  const preservedRetiredSectionIds =
    input.mode === "replace"
      ? preserveRetiredSectionIds.filter((sectionId) => {
          const section = lockedSectionById.get(sectionId);
          return (
            currentSectionIdSet.has(sectionId) &&
            section?.retiredAt != null &&
            inScope(sectionId)
          );
        })
      : [];
  const effectiveSectionIds = uniqueSectionIds([
    ...activeCandidateSectionIds,
    ...preservedRetiredSectionIds,
  ]);
  const effectiveSectionIdSet = new Set(effectiveSectionIds);
  const currentSectionIdsInScope =
    input.mode === "replace"
      ? currentSectionIds.filter(inScope)
      : currentSectionIds;
  const addedSectionIds = effectiveSectionIds.filter(
    (sectionId) => !currentSectionIdSet.has(sectionId),
  );
  const unchangedSectionIds = effectiveSectionIds.filter((sectionId) =>
    currentSectionIdSet.has(sectionId),
  );
  const removedSectionIds =
    input.mode === "replace"
      ? currentSectionIdsInScope.filter(
          (sectionId) => !effectiveSectionIdSet.has(sectionId),
        )
      : [];

  if (input.mode === "connect") {
    await connectUserSectionIds(tx, input.userId, addedSectionIds);
  } else if (input.semesterId === undefined) {
    await replaceUserSectionIds(tx, input.userId, effectiveSectionIds);
  } else {
    await replaceUserSectionIdsInSemester(
      tx,
      input.userId,
      currentSectionIdsInScope,
      effectiveSectionIds,
    );
  }

  return {
    activeCandidateSectionIds,
    addedSectionIds,
    effectiveSectionIds,
    preservedRetiredSectionIds,
    removedSectionIds,
    unchangedSectionIds,
  };
}

async function mutateUserSectionSubscriptions(
  input: LockedSectionSubscriptionMutationInput,
) {
  return prisma.$transaction((tx) =>
    mutateUserSectionSubscriptionsInTransaction(tx, input),
  );
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

async function disconnectUserSectionIds(
  userId: string,
  sectionIds: readonly number[],
) {
  const validSectionIds = await getExistingSectionIds(sectionIds, {
    includeRetired: true,
  });
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
  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: sectionIds,
    mode: "replace",
    preserveRetiredSectionIds: sectionIds,
    userId,
  });
  if (!mutation) {
    return null;
  }

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
  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: sectionIds,
    mode: "connect",
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

export async function addUserSectionSubscriptions(
  userId: string,
  sectionIds: readonly number[],
) {
  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: sectionIds,
    mode: "connect",
    userId,
  });
  if (!mutation) {
    return null;
  }

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

  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: matches.sections.map((section) => section.id),
    mode: "connect",
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
  action: "add" | "remove" | "set";
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
  let preservedRetiredIds: number[] = [];
  let responseResolved = resolved;
  let responseSections = resolved.sections;
  let responseTotal = resolved.total;

  if (action === "add") {
    const mutation = await mutateUserSectionSubscriptions({
      candidateSectionIds: targetIds,
      mode: "connect",
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
    const user = await getMutableUserSubscriptions(userId);
    if (!user) return null;
    const currentIdSet = new Set(
      user.subscribedSections.map((section) => section.id),
    );
    const removedIds = targetIds.filter((id) => currentIdSet.has(id));
    removedCount = removedIds.length;
    unchangedCount = targetIds.length - removedCount;
    await disconnectUserSectionIds(userId, removedIds);
  } else {
    const mutation = await mutateUserSectionSubscriptions({
      candidateSectionIds: targetIds,
      mode: "replace",
      preserveRetiredSectionIds: sectionIds,
      semesterId,
      userId,
    });
    if (!mutation) return null;
    acceptedTargetIds = mutation.activeCandidateSectionIds;
    preservedRetiredIds = mutation.preservedRetiredSectionIds;
    addedCount = mutation.addedSectionIds.length;
    removedCount = mutation.removedSectionIds.length;
    unchangedCount = mutation.unchangedSectionIds.length;
    responseResolved = filterResolvedCalendarSubscriptionSections(
      resolved,
      acceptedTargetIds,
      codes ?? [],
    );
    const effectiveResolved = await resolveCalendarSubscriptionSections({
      includeRetired: true,
      locale,
      sectionIds: mutation.effectiveSectionIds,
    });
    responseSections = effectiveResolved?.sections ?? [];
    responseTotal = responseSections.length;
  }

  const acceptedTargetIdSet = new Set(acceptedTargetIds);
  const acceptedRequestedIdSet = new Set([
    ...resolved.matchedSectionIds.filter((sectionId) =>
      acceptedTargetIdSet.has(sectionId),
    ),
    ...preservedRetiredIds,
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

  const mutation = await mutateUserSectionSubscriptions({
    candidateSectionIds: [sectionId],
    mode: "connect",
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
      mode: "connect",
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

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      subscribedSections: { disconnect: { id: sectionId } },
    },
  });

  return {
    sectionJwId: input.sectionJwId,
    subscribed: false,
  };
}
