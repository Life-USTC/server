import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpdate, type ColumnValue, chunks } from "./database-writes";
import { type ScheduleBuild, scheduleKey } from "./mappers";
import { requiredId } from "./required-id";

type ResolvedSchedule = {
  periods: number;
  date: Date | undefined;
  weekday: number;
  startTime: number;
  endTime: number;
  experiment: string | undefined;
  customPlace: string | undefined;
  lessonType: string | undefined;
  weekIndex: number;
  exerciseClass: boolean | null | undefined;
  startUnit: number;
  endUnit: number;
  roomId: number | undefined;
  sectionId: number;
  scheduleGroupId: number;
  key: string;
  teacherParticipations: ScheduleBuild["teacherParticipations"];
};

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
];

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

export async function writeSchedules(
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
    select: {
      id: true,
      periods: true,
      date: true,
      weekday: true,
      startTime: true,
      endTime: true,
      experiment: true,
      customPlace: true,
      lessonType: true,
      weekIndex: true,
      exerciseClass: true,
      startUnit: true,
      endUnit: true,
      roomId: true,
      sectionId: true,
      scheduleGroupId: true,
    },
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

  if (staleIds.length > 0) {
    await tx.schedule.deleteMany({ where: { id: { in: staleIds } } });
  }
  await bulkUpdate(
    tx,
    "Schedule",
    SCHEDULE_COLUMNS,
    SCHEDULE_COLUMN_TYPES,
    updates,
  );
  for (const chunk of chunks(inserts, 1000)) {
    await tx.schedule.createMany({ data: chunk.map(scheduleCreateData) });
  }

  const scheduleRows = await tx.schedule.findMany({
    where: { sectionId: { in: sectionDbIds } },
    select: {
      id: true,
      sectionId: true,
      scheduleGroupId: true,
      date: true,
      weekday: true,
      startTime: true,
      endTime: true,
      startUnit: true,
      endUnit: true,
      customPlace: true,
      weekIndex: true,
      roomId: true,
    },
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
  return [
    schedule.periods,
    schedule.date,
    schedule.weekday,
    schedule.startTime,
    schedule.endTime,
    schedule.experiment,
    schedule.customPlace,
    schedule.lessonType,
    schedule.weekIndex,
    schedule.exerciseClass ?? undefined,
    schedule.startUnit,
    schedule.endUnit,
    schedule.roomId,
    schedule.sectionId,
    schedule.scheduleGroupId,
  ];
}

function scheduleCreateData(schedule: ResolvedSchedule) {
  return {
    periods: schedule.periods,
    date: schedule.date,
    weekday: schedule.weekday,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    experiment: schedule.experiment,
    customPlace: schedule.customPlace,
    lessonType: schedule.lessonType,
    weekIndex: schedule.weekIndex,
    exerciseClass: schedule.exerciseClass,
    startUnit: schedule.startUnit,
    endUnit: schedule.endUnit,
    roomId: schedule.roomId,
    sectionId: schedule.sectionId,
    scheduleGroupId: schedule.scheduleGroupId,
  };
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
      lessonId: row.sectionId,
      scheduleGroupId: row.scheduleGroupId,
      date: row.date == null ? undefined : formatLocalDate(row.date),
      weekday: row.weekday,
      startTime: row.startTime,
      endTime: row.endTime,
      startUnit: row.startUnit,
      endUnit: row.endUnit,
      customPlace: row.customPlace,
      weekIndex: row.weekIndex,
    },
    row.roomId ?? undefined,
  );
}

function scheduleRowMatches(
  row: Parameters<typeof scheduleRowKey>[0] & {
    periods: number;
    experiment: string | null;
    lessonType: string | null;
    exerciseClass: boolean | null;
  },
  schedule: ResolvedSchedule,
): boolean {
  const rowValues = [
    row.periods,
    row.date?.getTime(),
    row.weekday,
    row.startTime,
    row.endTime,
    row.experiment ?? undefined,
    row.customPlace ?? undefined,
    row.lessonType ?? undefined,
    row.weekIndex,
    row.exerciseClass ?? undefined,
    row.startUnit,
    row.endUnit,
    row.roomId ?? undefined,
    row.sectionId,
    row.scheduleGroupId,
  ];
  const scheduleValues = scheduleColumnValues(schedule).map((value) =>
    value instanceof Date ? value.getTime() : value,
  );
  return rowValues.every((value, index) => value === scheduleValues[index]);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
