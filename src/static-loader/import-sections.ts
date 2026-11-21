/** Static-import upserts for sections, schedule groups, exams, and exam rooms. */
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert, type ColumnValue } from "./database-writes";
import type { LookupMaps } from "./import-lookups";
import type { ExamBuild, ScheduleGroupBuild, SectionBuild } from "./mappers";
import { optionalId, requiredId } from "./required-id";

export async function upsertSections(
  tx: Prisma.TransactionClient,
  builds: SectionBuild[],
  semesterMap: Map<number, number>,
  departmentMap: Map<string, number>,
  courseMap: Map<number, number>,
  lookupMaps: LookupMaps,
  campusMap: Map<number, number>,
  roomTypeMap: Map<number, number>,
): Promise<Map<number, number>> {
  const columns = [
    "code",
    "bizTypeId",
    "credits",
    "period",
    "requiredWeeks",
    "catalogAdminClasses",
    "periodsPerWeek",
    "timesPerWeek",
    "stdCount",
    "limitCount",
    "graduateAndPostgraduate",
    "dateTimePlaceText",
    "dateTimePlacePersonText",
    "actualPeriods",
    "theoryPeriods",
    "practicePeriods",
    "experimentPeriods",
    "machinePeriods",
    "designPeriods",
    "testPeriods",
    "scheduleState",
    "suggestScheduleWeeks",
    "suggestScheduleWeekInfo",
    "scheduleJsonParams",
    "selectedStdCount",
    "remark",
    "scheduleRemark",
    "courseId",
    "semesterId",
    "campusId",
    "examModeId",
    "openDepartmentId",
    "teachLanguageId",
    "roomTypeId",
  ] as const;
  const records: Array<{ key: number; values: ColumnValue[] }> = [];
  const unresolvedDepartmentCodes = new Set<string>();
  for (const build of builds) {
    const courseId = courseMap.get(build.courseJwId);
    if (courseId == null) {
      throw new Error(
        `Course jwId ${build.courseJwId} did not resolve for section jwId ${build.jwId}`,
      );
    }
    const semesterId = requiredId(
      semesterMap,
      build.semesterCode,
      `Semester jwId ${build.semesterCode} for Section jwId ${build.jwId}`,
    );
    const openDepartmentId = build.openDepartmentCode
      ? departmentMap.get(build.openDepartmentCode)
      : null;
    if (build.openDepartmentCode && openDepartmentId == null) {
      unresolvedDepartmentCodes.add(build.openDepartmentCode);
    }
    const campusId =
      build.campusId == null ? null : campusMap.get(build.campusId);
    if (campusId == null && build.campusId != null) {
      throw new Error(
        `Campus jwId ${build.campusId} did not resolve for section jwId ${build.jwId}`,
      );
    }
    const values = {
      ...build,
      catalogAdminClasses: JSON.stringify(build.catalogAdminClasses ?? []),
      dateTimePlacePersonText:
        build.dateTimePlacePersonText == null
          ? null
          : JSON.stringify(build.dateTimePlacePersonText),
      suggestScheduleWeeks:
        build.suggestScheduleWeeks == null
          ? null
          : JSON.stringify(build.suggestScheduleWeeks),
      scheduleJsonParams:
        build.scheduleJsonParams == null
          ? null
          : JSON.stringify(build.scheduleJsonParams),
      courseId,
      semesterId,
      campusId,
      openDepartmentId,
      examModeId: optionalId(
        lookupMaps.examMode,
        build.examModeName,
        `ExamMode ${build.examModeName} for Section jwId ${build.jwId}`,
      ),
      teachLanguageId: optionalId(
        lookupMaps.teachLanguage,
        build.teachLanguageName,
        `TeachLanguage ${build.teachLanguageName} for Section jwId ${build.jwId}`,
      ),
      roomTypeId: optionalId(
        roomTypeMap,
        build.roomTypeId,
        `RoomType jwId ${build.roomTypeId} for Section jwId ${build.jwId}`,
      ),
    };
    records.push({
      key: build.jwId,
      values: columns.map((column) => values[column]),
    });
  }
  if (unresolvedDepartmentCodes.size > 0) {
    throw new Error(
      `Section department codes have no authoritative upstream Department id: ${[...unresolvedDepartmentCodes].sort().join(", ")}`,
    );
  }
  return bulkUpsert(
    tx,
    "Section",
    "jwId",
    "int",
    [...columns],
    [
      "text",
      "int",
      "float8",
      "int",
      "int",
      "jsonb",
      "float8",
      "int",
      "int",
      "int",
      "boolean",
      "text",
      "jsonb",
      "float8",
      "float8",
      "float8",
      "float8",
      "float8",
      "float8",
      "float8",
      "text",
      "jsonb",
      "text",
      "jsonb",
      "int",
      "text",
      "text",
      "int",
      "int",
      "int",
      "int",
      "int",
      "int",
      "int",
    ],
    records,
  );
}

export async function upsertScheduleGroups(
  tx: Prisma.TransactionClient,
  builds: ScheduleGroupBuild[],
  sectionMap: Map<number, number>,
): Promise<Map<number, number>> {
  const columns = [
    "no",
    "limitCount",
    "stdCount",
    "actualPeriods",
    "isDefault",
    "sectionId",
  ] as const;
  const records: Array<{ key: number; values: ColumnValue[] }> = [];
  for (const build of builds) {
    const sectionId = requiredId(
      sectionMap,
      build.lessonJwId,
      `Section jwId ${build.lessonJwId} for ScheduleGroup jwId ${build.jwId}`,
    );
    records.push({
      key: build.jwId,
      values: columns.map((column) =>
        column === "sectionId" ? sectionId : build[column],
      ),
    });
  }
  return bulkUpsert(
    tx,
    "ScheduleGroup",
    "jwId",
    "int",
    [...columns],
    ["int", "int", "int", "float8", "boolean", "int"],
    records,
  );
}

export async function upsertExams(
  tx: Prisma.TransactionClient,
  builds: ExamBuild[],
  sectionMap: Map<number, number>,
  examBatchMap: Map<number, number>,
): Promise<Map<number, number>> {
  const columns = [
    "examType",
    "startTime",
    "endTime",
    "examDate",
    "examTakeCount",
    "examMode",
    "grades",
    "adminClassNames",
    "monitors",
    "examBatchId",
    "sectionId",
  ] as const;
  const records: Array<{ key: number; values: ColumnValue[] }> = [];
  for (const build of builds) {
    const sectionId = requiredId(
      sectionMap,
      build.sectionJwId,
      `Section jwId ${build.sectionJwId} for Exam jwId ${build.jwId}`,
    );
    const examBatchId = optionalId(
      examBatchMap,
      build.examBatchJwId,
      `ExamBatch jwId ${build.examBatchJwId} for Exam jwId ${build.jwId}`,
    );
    const values = {
      ...build,
      monitors: JSON.stringify(build.monitors ?? []),
      examBatchId,
      sectionId,
    };
    records.push({
      key: build.jwId,
      values: columns.map((column) => values[column]),
    });
  }
  return bulkUpsert(
    tx,
    "Exam",
    "jwId",
    "int",
    [...columns],
    [
      "int",
      "int",
      "int",
      "date",
      "int",
      "text",
      "text",
      "text",
      "jsonb",
      "int",
      "int",
    ],
    records,
  );
}

export async function writeExamRooms(
  tx: Prisma.TransactionClient,
  builds: ExamBuild[],
  examMap: Map<number, number>,
): Promise<void> {
  const examIds = builds.map((build) =>
    requiredId(examMap, build.jwId, `Exam jwId ${build.jwId}`),
  );
  if (examIds.length === 0) return;
  await tx.examRoom.deleteMany({ where: { examId: { in: examIds } } });

  const data: Array<{ examId: number; room: string; count: number }> = [];
  for (const build of builds) {
    const examId = requiredId(examMap, build.jwId, `Exam jwId ${build.jwId}`);
    for (const room of build.rooms) {
      data.push({ examId, room: room.room, count: room.count });
    }
  }

  if (data.length > 0) {
    await tx.examRoom.createMany({ data });
  }
}
