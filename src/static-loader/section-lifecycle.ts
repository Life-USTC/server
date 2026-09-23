import type { Prisma } from "../generated/prisma-node/client";
import { acquireSectionLifecycleAdvisoryLocks } from "../lib/db/section-lifecycle-lock";

type SectionPresenceTransaction = Pick<
  Prisma.TransactionClient,
  "$queryRawUnsafe"
> & {
  auditLog: Pick<Prisma.TransactionClient["auditLog"], "createMany">;
  section: Pick<
    Prisma.TransactionClient["section"],
    "count" | "findMany" | "updateMany"
  >;
};

type SectionPresenceCounts = {
  active: number;
  retired: number;
  total: number;
};

export type SectionPresenceStats = {
  status: "applied";
  scopeSemesterCount: number;
  seenSectionCount: number;
  missingSectionCount: number;
  deactivatedCount: number;
  reactivatedCount: number;
  before: SectionPresenceCounts;
  after: SectionPresenceCounts;
};

type SectionPresenceInput = {
  observedAt: Date;
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

export function emptySectionPresenceStats(): SectionPresenceStats {
  return {
    status: "applied",
    scopeSemesterCount: 0,
    seenSectionCount: 0,
    missingSectionCount: 0,
    deactivatedCount: 0,
    reactivatedCount: 0,
    before: lifecycleCounts(0, 0),
    after: lifecycleCounts(0, 0),
  };
}

export async function reconcileSectionPresence(
  tx: SectionPresenceTransaction,
  input: SectionPresenceInput,
): Promise<SectionPresenceStats> {
  const scopedSemesterIds = uniqueSorted(input.scopedSemesterIds);
  const seenSectionJwIds = uniqueSorted(input.seenSectionJwIds);
  if (scopedSemesterIds.length === 0) return emptySectionPresenceStats();
  if (seenSectionJwIds.length === 0) {
    throw new Error(
      "Refusing to deactivate Sections because the validated source set is empty",
    );
  }

  const scopedWhere = { semesterId: { in: scopedSemesterIds } };
  const activeBefore = await tx.section.count({
    where: { ...scopedWhere, retiredAt: null },
  });
  const retiredBefore = await tx.section.count({
    where: { ...scopedWhere, retiredAt: { not: null } },
  });

  let reactivatedSections = await tx.section.findMany({
    where: {
      ...scopedWhere,
      jwId: { in: seenSectionJwIds },
      retiredAt: { not: null },
    },
    select: { id: true, jwId: true, retiredAt: true },
  });
  let missingSections = await tx.section.findMany({
    where: {
      ...scopedWhere,
      jwId: { notIn: seenSectionJwIds },
      retiredAt: null,
    },
    select: { id: true, jwId: true },
  });

  const stateChangeIds = uniqueSorted([
    ...reactivatedSections.map((section) => section.id),
    ...missingSections.map((section) => section.id),
  ]);
  if (stateChangeIds.length > 0) {
    await acquireSectionLifecycleAdvisoryLocks(tx, stateChangeIds, "exclusive");
    const lockedSections = await tx.section.findMany({
      where: { id: { in: stateChangeIds } },
      select: { id: true, jwId: true, retiredAt: true },
    });
    const lockedById = new Map(
      lockedSections.map((section) => [section.id, section] as const),
    );
    reactivatedSections = reactivatedSections.flatMap((section) => {
      const locked = lockedById.get(section.id);
      return locked?.retiredAt == null ? [] : [locked];
    });
    missingSections = missingSections.flatMap((section) => {
      const locked = lockedById.get(section.id);
      return locked?.retiredAt != null || locked == null ? [] : [locked];
    });
  }

  if (reactivatedSections.length > 0) {
    await tx.section.updateMany({
      where: { id: { in: reactivatedSections.map((section) => section.id) } },
      data: { retiredAt: null },
    });
  }
  if (missingSections.length > 0) {
    await tx.section.updateMany({
      where: {
        id: { in: missingSections.map((section) => section.id) },
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
    ...missingSections.map((section) => ({
      action: "section_retire" as const,
      targetId: String(section.id),
      targetType: "section",
      metadata: {
        jwId: section.jwId,
        observedAt,
        snapshotSha256: input.snapshotSha256,
        source: "static-loader",
      },
    })),
  ];
  if (auditRows.length > 0) {
    await tx.auditLog.createMany({ data: auditRows });
  }

  const reactivatedCount = reactivatedSections.length;
  const deactivatedCount = missingSections.length;
  return {
    status: "applied",
    scopeSemesterCount: scopedSemesterIds.length,
    seenSectionCount: seenSectionJwIds.length,
    missingSectionCount: missingSections.length,
    deactivatedCount,
    reactivatedCount,
    before: lifecycleCounts(activeBefore, retiredBefore),
    after: lifecycleCounts(
      activeBefore + reactivatedCount - deactivatedCount,
      retiredBefore - reactivatedCount + deactivatedCount,
    ),
  };
}
