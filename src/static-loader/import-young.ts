/** Static-import young-event sync and post-import database counts. */
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert, type ColumnValue } from "./database-writes";
import type { ImportRecordCounts } from "./import-types";
import type { YoungEventBuild } from "./young-plan";

export async function syncYoungEvents(
  tx: Prisma.TransactionClient,
  builds: YoungEventBuild[],
): Promise<void> {
  const columns = [
    "name",
    "category",
    "department",
    "organizer",
    "status",
    "registrationStatus",
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
    "rawJson",
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
      "float8",
      "int",
      "int",
      "timestamp",
      "timestamp",
      "timestamp",
      "timestamp",
      "boolean",
      "jsonb",
    ],
    builds.map((build) => ({
      key: build.youngId,
      values: [
        build.name,
        build.category,
        build.department,
        build.organizer,
        build.status,
        build.registrationStatus,
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
        build.rawJson,
      ] satisfies ColumnValue[],
    })),
  );

  // The snapshot is authoritative for both lists; drop events that disappeared.
  // An empty snapshot means the upstream fetch broke (the ended list alone
  // carries thousands of historical events), so keep existing rows instead of
  // wiping the table.
  if (builds.length === 0) return;
  const keepYoungIds = builds.map((build) => build.youngId);
  await tx.youngEvent.deleteMany({
    where: { youngId: { notIn: keepYoungIds } },
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
