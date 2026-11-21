import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpdate, type ColumnValue, chunks } from "./database-writes";
import { type ScheduleBuild, scheduleKey } from "./mappers";
import { requiredId } from "./required-id";

const SCHEDULE_COLUMNS = [
  "periods",
  "date",
  "weekday",
  "startTime",
  "endTime",
  "experiment",
  "customPlace",
  "lessonType",
  "weekIndex",
  "exerciseClass",
  "startUnit",
  "endUnit",
  "roomId",
  "sectionId",
  "scheduleGroupId",
] as const;

const SCHEDULE_COLUMN_TYPES = [
  "float8",
  "date",
  "int",
  "int",
  "int",
  "text",
  "text",
  "text",
  "int",
  "boolean",
  "int",
  "int",
  "int",
  "int",
  "int",
];

type ScheduleValues = Pick<
  Prisma.ScheduleUncheckedCreateInput,
  (typeof SCHEDULE_COLUMNS)[number]
>;
type ResolvedSchedule = ScheduleValues & {
  key: string;
  teacherParticipations: ScheduleBuild["teacherParticipations"];
};

export async function writeSchedules(
  tx: Prisma.TransactionClient,
  builds: ScheduleBuild[],
  sectionMap: Map<number, number>,
  scheduleGroupMap: Map<number, number>,
  roomMap: Map<number, number>,
  teacherMap: Map<number, number>,
  sectionDbIds: number[],
): Promise<void> {
  const buildsBySection = new Map<number, ScheduleBuild[]>();
  for (const build of builds) {
    const sectionId = requiredId(
      sectionMap,
      build.lessonJwId,
      `Section jwId ${build.lessonJwId} for Schedule`,
    );
    const sectionBuilds = buildsBySection.get(sectionId) ?? [];
    sectionBuilds.push(build);
    buildsBySection.set(sectionId, sectionBuilds);
  }
  // Reconcile complete sections, including those whose new timetable is empty.
  // Keep all writes in the caller's single transaction, but never load the
  // production's entire schedule history or a second resolved copy at once.
  for (const scopeIds of chunks(sectionDbIds, 500)) {
    await writeScheduleBatch(
      tx,
      scopeIds.flatMap((id) => buildsBySection.get(id) ?? []),
      sectionMap,
      scheduleGroupMap,
      roomMap,
      teacherMap,
      scopeIds,
    );
  }
}

async function writeScheduleBatch(
  tx: Prisma.TransactionClient,
  builds: ScheduleBuild[],
  sectionMap: Map<number, number>,
  scheduleGroupMap: Map<number, number>,
  roomMap: Map<number, number>,
  teacherMap: Map<number, number>,
  sectionDbIds: number[],
): Promise<void> {
  const resolved: ResolvedSchedule[] = builds.map((build) => {
    const sectionId = requiredId(
      sectionMap,
      build.lessonJwId,
      `Section jwId ${build.lessonJwId} for Schedule`,
    );
    const scheduleGroupId = requiredId(
      scheduleGroupMap,
      build.scheduleGroupJwId,
      `ScheduleGroup jwId ${build.scheduleGroupJwId} for Section jwId ${build.lessonJwId}`,
    );
    const roomId =
      build.roomJwId == null
        ? undefined
        : requiredId(
            roomMap,
            build.roomJwId,
            `Room jwId ${build.roomJwId} for Section jwId ${build.lessonJwId}`,
          );
    return {
      periods: build.periods ?? 0,
      date: build.date,
      weekday: build.weekday,
      startTime: build.startTime,
      endTime: build.endTime,
      experiment: build.experiment,
      customPlace: build.customPlace,
      lessonType: build.lessonType,
      weekIndex: build.weekIndex,
      exerciseClass: build.exerciseClass,
      startUnit: build.startUnit,
      endUnit: build.endUnit,
      roomId,
      sectionId,
      scheduleGroupId,
      key: scheduleKey(
        {
          lessonId: sectionId,
          scheduleGroupId,
          date: build.dateStr,
          weekday: build.weekday,
          startTime: build.startTime,
          endTime: build.endTime,
          startUnit: build.startUnit,
          endUnit: build.endUnit,
          customPlace: build.customPlace,
          weekIndex: build.weekIndex,
        },
        roomId,
      ),
      teacherParticipations: build.teacherParticipations,
    };
  });

  const existingRows = await tx.schedule.findMany({
    where: { sectionId: { in: sectionDbIds } },
  });

  const existingByKey = new Map<string, (typeof existingRows)[number]>();
  const staleIds: number[] = [];
  for (const row of existingRows) {
    const key = scheduleRowKey(row);
    if (existingByKey.has(key)) staleIds.push(row.id);
    else existingByKey.set(key, row);
  }

  const desiredKeys = new Set(resolved.map((schedule) => schedule.key));
  const inserts: ResolvedSchedule[] = [];
  const updates: Array<{ id: number; values: ColumnValue[] }> = [];
  for (const schedule of resolved) {
    const existing = existingByKey.get(schedule.key);
    if (existing == null) inserts.push(schedule);
    else if (!scheduleRowMatches(existing, schedule)) {
      updates.push({ id: existing.id, values: scheduleColumnValues(schedule) });
    }
  }
  for (const [key, row] of existingByKey) {
    if (!desiredKeys.has(key)) staleIds.push(row.id);
  }

  for (const ids of chunks(staleIds, 1000)) {
    await tx.schedule.deleteMany({ where: { id: { in: ids } } });
  }
  await bulkUpdate(
    tx,
    "Schedule",
    [...SCHEDULE_COLUMNS],
    SCHEDULE_COLUMN_TYPES,
    updates,
  );
  for (const chunk of chunks(inserts, 1000)) {
    await tx.schedule.createMany({ data: chunk.map(scheduleCreateData) });
  }

  const scheduleRows =
    inserts.length === 0
      ? existingRows
      : await tx.schedule.findMany({
          where: { sectionId: { in: sectionDbIds } },
        });
  const scheduleKeyToId = new Map<string, number>();
  for (const row of scheduleRows) {
    scheduleKeyToId.set(scheduleRowKey(row), row.id);
  }

  for (const batch of chunks(resolved, 1000)) {
    const scopeIds: number[] = [];
    const participations: Array<{
      A: number;
      B: number;
      periods: number | null;
      exerciseClass: boolean | null;
    }> = [];
    for (const schedule of batch) {
      const scheduleId = requiredId(
        scheduleKeyToId,
        schedule.key,
        `Schedule ${schedule.key}`,
      );
      scopeIds.push(scheduleId);
      for (const participation of schedule.teacherParticipations) {
        const teacherId = requiredId(
          teacherMap,
          participation.teacherJwId,
          `Teacher jwId ${participation.teacherJwId} for Schedule ${schedule.key}`,
        );
        participations.push({
          A: scheduleId,
          B: teacherId,
          periods: participation.periods ?? null,
          exerciseClass: participation.exerciseClass ?? null,
        });
      }
    }
    const payload = JSON.stringify(participations);
    await tx.$executeRawUnsafe(
      `DELETE FROM "_ScheduleTeachers" AS target
       WHERE target."A" = ANY($1::int[]) AND NOT EXISTS (
         SELECT 1 FROM jsonb_to_recordset($2::jsonb) AS desired("A" int, "B" int)
         WHERE desired."A" = target."A" AND desired."B" = target."B"
       )`,
      scopeIds,
      payload,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "_ScheduleTeachers" ("A", "B", "periods", "exerciseClass")
       SELECT "A", "B", "periods", "exerciseClass"
       FROM jsonb_to_recordset($1::jsonb)
         AS desired("A" int, "B" int, "periods" float8, "exerciseClass" boolean)
       ON CONFLICT ("A", "B") DO UPDATE SET
         "periods" = EXCLUDED."periods", "exerciseClass" = EXCLUDED."exerciseClass"
       WHERE ROW("_ScheduleTeachers"."periods", "_ScheduleTeachers"."exerciseClass")
         IS DISTINCT FROM ROW(EXCLUDED."periods", EXCLUDED."exerciseClass")`,
      payload,
    );
  }
}

function scheduleColumnValues(schedule: ResolvedSchedule): ColumnValue[] {
  return SCHEDULE_COLUMNS.map((column) => schedule[column]);
}

function scheduleCreateData(schedule: ResolvedSchedule) {
  const { key: _key, teacherParticipations: _teachers, ...data } = schedule;
  return data;
}

function scheduleRowKey(row: {
  sectionId: number;
  scheduleGroupId: number;
  date: Date | null;
  weekday: number;
  startTime: number;
  endTime: number;
  startUnit: number;
  endUnit: number;
  customPlace: string | null;
  weekIndex: number;
  roomId: number | null;
}): string {
  return scheduleKey(
    {
      ...row,
      lessonId: row.sectionId,
      scheduleGroupId: row.scheduleGroupId,
      date: row.date == null ? undefined : formatLocalDate(row.date),
    },
    row.roomId ?? undefined,
  );
}

function scheduleRowMatches(
  row: Pick<
    Prisma.ScheduleGetPayload<object>,
    (typeof SCHEDULE_COLUMNS)[number]
  >,
  schedule: ResolvedSchedule,
): boolean {
  const normalize = (value: unknown) =>
    value instanceof Date ? value.getTime() : (value ?? null);
  return SCHEDULE_COLUMNS.every(
    (column) => normalize(row[column]) === normalize(schedule[column]),
  );
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
