/** Static-import young-event sync and post-import database counts. */

import {
  displayYoungOrganizerName,
  normalizeYoungOrganizerName,
} from "../features/young/server/young-organizer-normalization";
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert, type ColumnValue } from "./database-writes";
import type { ImportRecordCounts } from "./import-types";
import type { YoungEventBuild } from "./young-plan";

/** Skip reused or older Young data even when another dataset advances the snapshot. */
export async function syncYoungSnapshot(
  tx: Prisma.TransactionClient,
  builds: YoungEventBuild[],
  syncedAt: Date | undefined,
): Promise<Date | undefined> {
  if (!syncedAt) return undefined;
  const current = await tx.staticImportState.findUnique({
    where: { id: "global" },
    select: { youngSyncedAt: true },
  });
  if (current?.youngSyncedAt && syncedAt <= current.youngSyncedAt)
    return undefined;
  await syncYoungEvents(tx, builds, { observedAt: syncedAt, complete: true });
  return syncedAt;
}

export type YoungEventSyncOptions = {
  /** Timestamp attached to rows observed by this static snapshot. */
  observedAt?: Date;
  /** Whether the snapshot is complete enough to reconcile absent rows. */
  complete?: boolean;
};

async function upsertYoungOrganizers(
  tx: Prisma.TransactionClient,
  builds: YoungEventBuild[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const build of builds) {
    const normalizedName = normalizeYoungOrganizerName(build.organizer);
    if (normalizedName == null) continue;
    names.set(
      normalizedName,
      displayYoungOrganizerName(build.organizer as string),
    );
  }

  if (names.size === 0) return new Map();
  await tx.youngOrganizer.createMany({
    data: [...names].map(([normalizedName, name]) => ({
      name,
      normalizedName,
    })),
    skipDuplicates: true,
  });
  const rows = await tx.youngOrganizer.findMany({
    where: { normalizedName: { in: [...names.keys()] } },
    select: { id: true, normalizedName: true },
  });
  return new Map(rows.map((row) => [row.normalizedName, row.id]));
}

export async function syncYoungEvents(
  tx: Prisma.TransactionClient,
  builds: YoungEventBuild[],
  options: YoungEventSyncOptions = {},
): Promise<void> {
  const observedAt = options.observedAt ?? new Date();
  const organizerIds = await upsertYoungOrganizers(tx, builds);
  const columns = [
    "name",
    "category",
    "department",
    "organizer",
    "organizerId",
    "status",
    "activityStatusCode",
    "signupStatusCode",
    "requiresSignup",
    "location",
    "imageUrl",
    "hours",
    "capacity",
    "appliedCount",
    "startAt",
    "endAt",
    "applyStartAt",
    "applyEndAt",
    "isActive",
    "sourceMissing",
    "lastSeenAt",
    "rawJson",
    "description",
    "participationNotes",
    "activityLevel",
    "module",
    "form",
    "grades",
    "sponsor",
    "contactName",
    "contactTel",
    "duration",
    "serviceHour",
    "sumHours",
    "sumPersons",
    "partakeNum",
    "favCount",
    "limitNum",
    "createdAtUpstream",
    "auditedAt",
    "updatedAtUpstream",
    "places",
  ];
  await bulkUpsert(
    tx,
    "YoungEvent",
    "youngId",
    "text",
    columns,
    [
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "boolean",
      "text",
      "text",
      "float8",
      "int",
      "int",
      "timestamp",
      "timestamp",
      "timestamp",
      "timestamp",
      "boolean",
      "boolean",
      "timestamp",
      "jsonb",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "float8",
      "float8",
      "float8",
      "int",
      "int",
      "int",
      "int",
      "timestamp",
      "timestamp",
      "timestamp",
      "jsonb",
    ],
    builds.map((build) => ({
      key: build.youngId,
      values: [
        build.name,
        build.category,
        build.department,
        build.organizer,
        normalizeYoungOrganizerName(build.organizer) == null
          ? null
          : (organizerIds.get(
              normalizeYoungOrganizerName(build.organizer) as string,
            ) ?? null),
        build.status,
        build.activityStatusCode,
        build.signupStatusCode,
        build.requiresSignup,
        build.location,
        build.imageUrl,
        build.hours,
        build.capacity,
        build.appliedCount,
        build.startAt,
        build.endAt,
        build.applyStartAt,
        build.applyEndAt,
        build.isActive,
        false,
        observedAt,
        build.rawJson,
        build.description,
        build.participationNotes,
        build.activityLevel,
        build.module,
        build.form,
        build.grades,
        build.sponsor,
        build.contactName,
        build.contactTel,
        build.duration,
        build.serviceHour,
        build.sumHours,
        build.sumPersons,
        build.partakeNum,
        build.favCount,
        build.limitNum,
        build.createdAtUpstream,
        build.auditedAt,
        build.updatedAtUpstream,
        build.places == null ? undefined : JSON.stringify(build.places),
      ] satisfies ColumnValue[],
    })),
  );

  // Keep rows that disappeared from the source so links and subscriptions stay
  // valid. Only a complete active + ended snapshot may mark them missing; a
  // partial snapshot must not turn a transient fetch gap into a false removal.
  if (!options.complete) return;
  await tx.youngEvent.updateMany({
    where:
      builds.length === 0
        ? {}
        : { youngId: { notIn: builds.map((build) => build.youngId) } },
    data: { sourceMissing: true },
  });
}

export async function countStats(
  prisma: Prisma.TransactionClient,
): Promise<ImportRecordCounts> {
  const [
    semesters,
    departments,
    courses,
    sections,
    teachers,
    scheduleGroups,
    schedules,
    exams,
    rooms,
    buildings,
    campuses,
    adminClasses,
    youngEvents,
  ] = await Promise.all([
    prisma.semester.count(),
    prisma.department.count(),
    prisma.course.count(),
    prisma.section.count(),
    prisma.teacher.count(),
    prisma.scheduleGroup.count(),
    prisma.schedule.count(),
    prisma.exam.count(),
    prisma.room.count(),
    prisma.building.count(),
    prisma.campus.count(),
    prisma.adminClass.count(),
    prisma.youngEvent.count(),
  ]);

  return {
    semesters,
    departments,
    courses,
    sections,
    teachers,
    scheduleGroups,
    schedules,
    exams,
    rooms,
    buildings,
    campuses,
    adminClasses,
    youngEvents,
  };
}
