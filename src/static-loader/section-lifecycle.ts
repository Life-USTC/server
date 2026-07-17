import type { Prisma } from "../generated/prisma-node/client";
import { acquireSectionLifecycleAdvisoryLocks } from "../lib/db/section-lifecycle-lock";

type SectionLifecycleTransaction = Pick<
  Prisma.TransactionClient,
  "$queryRawUnsafe"
> & {
  auditLog: Pick<Prisma.TransactionClient["auditLog"], "createMany">;
  section: Pick<
    Prisma.TransactionClient["section"],
    "count" | "findFirst" | "findMany" | "updateMany"
  >;
};

export type SectionLifecycleStats = {
  enabled: boolean;
  scopeSemesterCount: number;
  seenSectionCount: number;
  retirementCandidateCount: number;
  retiredCount: number;
  reactivatedCount: number;
  before: SectionLifecycleCounts;
  after: SectionLifecycleCounts;
};

type SectionLifecycleCounts = {
  active: number;
  retired: number;
  total: number;
};

type SectionLifecycleInput = {
  observedAt: Date;
  retirementEnabled: boolean;
  expectedRetirementCandidateCount: number | null;
  scopedSemesterIds: readonly number[];
  seenSectionJwIds: readonly number[];
  snapshotSha256: string;
};

function uniqueSorted(values: readonly number[]) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function lifecycleCounts(active: number, retired: number) {
  return { active, retired, total: active + retired };
}

function validateRetirementCandidates(
  input: SectionLifecycleInput,
  retirementCandidates: Array<{
    sourceLastSeenAt: Date | null;
  }>,
) {
  if (!input.retirementEnabled) return;
  if (input.expectedRetirementCandidateCount == null) {
    throw new Error(
      "STATIC_LOADER_EXPECTED_SECTION_RETIREMENT_CANDIDATES is required when missing-Section retirement is enabled",
    );
  }
  if (retirementCandidates.length !== input.expectedRetirementCandidateCount) {
    throw new Error(
      `Approved Section retirement candidate count ${input.expectedRetirementCandidateCount} does not match actual count ${retirementCandidates.length}`,
    );
  }
  if (
    retirementCandidates.some(
      (section) =>
        section.sourceLastSeenAt != null &&
        section.sourceLastSeenAt > input.observedAt,
    )
  ) {
    throw new Error(
      "Refusing to retire Sections from a snapshot older than their latest source observation",
    );
  }
}

export function emptySectionLifecycleStats(
  enabled: boolean,
): SectionLifecycleStats {
  return {
    enabled,
    scopeSemesterCount: 0,
    seenSectionCount: 0,
    retirementCandidateCount: 0,
    retiredCount: 0,
    reactivatedCount: 0,
    before: lifecycleCounts(0, 0),
    after: lifecycleCounts(0, 0),
  };
}

export async function assertSectionSnapshotNotOlderThanSource(
  tx: Pick<SectionLifecycleTransaction, "section">,
  input: {
    observedAt: Date;
    scopedSemesterIds: readonly number[];
  },
) {
  const scopedSemesterIds = uniqueSorted(input.scopedSemesterIds);
  if (scopedSemesterIds.length === 0) {
    return;
  }

  const newerSection = await tx.section.findFirst({
    where: {
      semesterId: { in: scopedSemesterIds },
      sourceLastSeenAt: { gt: input.observedAt },
    },
    orderBy: { sourceLastSeenAt: "desc" },
    select: { jwId: true, sourceLastSeenAt: true },
  });
  if (newerSection != null) {
    throw new Error(
      `Refusing to import snapshot generated at ${input.observedAt.toISOString()} because Section ${newerSection.jwId} was observed in a newer snapshot at ${newerSection.sourceLastSeenAt?.toISOString()}`,
    );
  }
}

export async function reconcileSectionSourceLifecycle(
  tx: SectionLifecycleTransaction,
  input: SectionLifecycleInput,
): Promise<SectionLifecycleStats> {
  const scopedSemesterIds = uniqueSorted(input.scopedSemesterIds);
  const seenSectionJwIds = uniqueSorted(input.seenSectionJwIds);
  if (scopedSemesterIds.length === 0) {
    return emptySectionLifecycleStats(input.retirementEnabled);
  }
  if (input.retirementEnabled && seenSectionJwIds.length === 0) {
    throw new Error(
      "Refusing to retire Sections because the validated source set is empty",
    );
  }

  const scopedWhere = { semesterId: { in: scopedSemesterIds } };
  const activeBefore = await tx.section.count({
    where: { ...scopedWhere, retiredAt: null },
  });
  const retiredBefore = await tx.section.count({
    where: { ...scopedWhere, retiredAt: { not: null } },
  });

  let reactivatedSections =
    seenSectionJwIds.length > 0
      ? await tx.section.findMany({
          where: {
            ...scopedWhere,
            jwId: { in: seenSectionJwIds },
            retiredAt: { lt: input.observedAt },
          },
          select: { id: true, jwId: true, retiredAt: true },
        })
      : [];

  let retirementCandidates = await tx.section.findMany({
    where: {
      ...scopedWhere,
      jwId: { notIn: seenSectionJwIds },
      retiredAt: null,
    },
    select: { id: true, jwId: true, sourceLastSeenAt: true },
  });

  validateRetirementCandidates(input, retirementCandidates);

  const lifecycleStateChangeIds = uniqueSorted([
    ...reactivatedSections.map((section) => section.id),
    ...(input.retirementEnabled
      ? retirementCandidates.map((section) => section.id)
      : []),
  ]);
  if (lifecycleStateChangeIds.length > 0) {
    await acquireSectionLifecycleAdvisoryLocks(
      tx,
      lifecycleStateChangeIds,
      "exclusive",
    );
    const lockedSections = await tx.section.findMany({
      where: { id: { in: lifecycleStateChangeIds } },
      select: {
        id: true,
        jwId: true,
        retiredAt: true,
        sourceLastSeenAt: true,
      },
    });
    const lockedSectionById = new Map(
      lockedSections.map((section) => [section.id, section] as const),
    );
    reactivatedSections = reactivatedSections.flatMap((section) => {
      const locked = lockedSectionById.get(section.id);
      if (locked?.retiredAt == null || locked.retiredAt >= input.observedAt) {
        return [];
      }
      return [
        {
          id: locked.id,
          jwId: locked.jwId,
          retiredAt: locked.retiredAt,
        },
      ];
    });
    if (input.retirementEnabled) {
      retirementCandidates = retirementCandidates.flatMap((section) => {
        const locked = lockedSectionById.get(section.id);
        if (!locked || locked.retiredAt != null) return [];
        return [
          {
            id: locked.id,
            jwId: locked.jwId,
            sourceLastSeenAt: locked.sourceLastSeenAt,
          },
        ];
      });
      validateRetirementCandidates(input, retirementCandidates);
    }
  }

  await tx.section.updateMany({
    where: {
      ...scopedWhere,
      jwId: { in: seenSectionJwIds },
      retiredAt: null,
      OR: [
        { sourceLastSeenAt: null },
        { sourceLastSeenAt: { lt: input.observedAt } },
      ],
    },
    data: {
      sourceLastSeenAt: input.observedAt,
    },
  });
  if (reactivatedSections.length > 0) {
    await tx.section.updateMany({
      where: {
        id: { in: reactivatedSections.map((section) => section.id) },
        retiredAt: { lt: input.observedAt },
      },
      data: {
        sourceLastSeenAt: input.observedAt,
        retiredAt: null,
      },
    });
  }

  const sectionsToRetire = input.retirementEnabled ? retirementCandidates : [];
  if (sectionsToRetire.length > 0) {
    await tx.section.updateMany({
      where: {
        id: { in: sectionsToRetire.map((section) => section.id) },
        retiredAt: null,
      },
      data: { retiredAt: input.observedAt },
    });
  }

  const observedAt = input.observedAt.toISOString();
  const auditRows: Prisma.AuditLogCreateManyInput[] = [
    ...reactivatedSections.map((section) => ({
      action: "section_reactivate" as const,
      targetId: String(section.id),
      targetType: "section",
      metadata: {
        jwId: section.jwId,
        observedAt,
        previousRetiredAt: section.retiredAt?.toISOString() ?? null,
        snapshotSha256: input.snapshotSha256,
        source: "static-loader",
      },
    })),
    ...sectionsToRetire.map((section) => ({
      action: "section_retire" as const,
      targetId: String(section.id),
      targetType: "section",
      metadata: {
        jwId: section.jwId,
        observedAt,
        previousSourceLastSeenAt:
          section.sourceLastSeenAt?.toISOString() ?? null,
        snapshotSha256: input.snapshotSha256,
        source: "static-loader",
      },
    })),
  ];
  if (auditRows.length > 0) {
    await tx.auditLog.createMany({ data: auditRows });
  }

  const reactivatedCount = reactivatedSections.length;
  const retiredCount = sectionsToRetire.length;
  return {
    enabled: input.retirementEnabled,
    scopeSemesterCount: scopedSemesterIds.length,
    seenSectionCount: seenSectionJwIds.length,
    retirementCandidateCount: retirementCandidates.length,
    retiredCount,
    reactivatedCount,
    before: lifecycleCounts(activeBefore, retiredBefore),
    after: lifecycleCounts(
      activeBefore + reactivatedCount - retiredCount,
      retiredBefore - reactivatedCount + retiredCount,
    ),
  };
}
