import type { Prisma } from "../generated/prisma-node/client";
import { chunks, syncJoinPairs } from "./database-writes";
import type {
  AdminClassSectionPair,
  SectionTeacherPair,
  TeacherAssignmentBuild,
} from "./mappers";
import { requiredId } from "./required-id";

export async function writeSectionTeachers(
  tx: Prisma.TransactionClient,
  sectionMap: Map<number, number>,
  teacherMap: Map<number, number>,
  pairs: SectionTeacherPair[],
  sectionDbIds: number[],
): Promise<void> {
  const resolved: Array<{ sectionId: number; teacherId: number }> = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const sectionId = requiredId(
      sectionMap,
      pair.sectionJwId,
      `Section jwId ${pair.sectionJwId} for teacher relation`,
    );
    const teacherId = requiredId(
      teacherMap,
      pair.teacherJwId,
      `Teacher jwId ${pair.teacherJwId} for Section jwId ${pair.sectionJwId}`,
    );
    const key = `${sectionId}:${teacherId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ sectionId, teacherId });
  }

  await syncJoinPairs(
    tx,
    "_SectionTeachers",
    "A",
    sectionDbIds,
    resolved.map((pair) => ({ a: pair.sectionId, b: pair.teacherId })),
  );

  const now = new Date();
  for (const chunk of chunks(resolved, 1000)) {
    const tuples = chunk
      .map((pair) => `(${pair.sectionId},${pair.teacherId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `UPDATE "SectionTeacher" SET "retiredAt" = NULL, "updatedAt" = $1 WHERE ("sectionId","teacherId") IN (${tuples}) AND "retiredAt" IS NOT NULL`,
      now,
    );
  }
  for (const chunk of chunks(resolved, 1000)) {
    await tx.sectionTeacher.createMany({
      data: chunk.map((pair) => ({ ...pair, retiredAt: null })),
      skipDuplicates: true,
    });
  }
  for (const sectionChunk of chunks(sectionDbIds, 1000)) {
    const sectionIds = sectionChunk.join(",");
    await tx.$executeRawUnsafe(
      `UPDATE "SectionTeacher" SET "retiredAt" = $1, "updatedAt" = $2 WHERE "sectionId" IN (${sectionIds}) AND "retiredAt" IS NULL AND ("sectionId","teacherId") NOT IN (SELECT "A","B" FROM "_SectionTeachers" WHERE "A" IN (${sectionIds}))`,
      now,
      now,
    );
  }
}

export async function writeTeacherAssignments(
  tx: Prisma.TransactionClient,
  builds: TeacherAssignmentBuild[],
  sectionMap: Map<number, number>,
  teacherMap: Map<number, number>,
  teacherLessonTypeMap: Map<number, number>,
  teacherTitleMap: Map<number, number>,
): Promise<void> {
  const resolved = builds.map((build) => ({
    teacherId: requiredId(
      teacherMap,
      build.teacherJwId,
      `Teacher jwId ${build.teacherJwId} for Section jwId ${build.sectionJwId}`,
    ),
    sectionId: requiredId(
      sectionMap,
      build.sectionJwId,
      `Section jwId ${build.sectionJwId} for TeacherAssignment`,
    ),
    role: build.role,
    period: build.period,
    weekIndices: build.weekIndices,
    weekIndicesMsg: build.weekIndicesMsg,
    teacherLessonTypeId:
      build.teacherLessonTypeId == null
        ? undefined
        : requiredId(
            teacherLessonTypeMap,
            build.teacherLessonTypeId,
            `TeacherLessonType jwId ${build.teacherLessonTypeId}`,
          ),
    teacherTitleId:
      build.teacherTitleJwId == null
        ? undefined
        : requiredId(
            teacherTitleMap,
            build.teacherTitleJwId,
            `TeacherTitle jwId ${build.teacherTitleJwId}`,
          ),
  }));
  const unique = uniqueBy(
    resolved,
    (row) => `${row.sectionId}:${row.teacherId}`,
  );

  await tx.teacherAssignment.deleteMany({
    where: { sectionId: { in: Array.from(sectionMap.values()) } },
  });
  for (const chunk of chunks(unique, 1000)) {
    await tx.teacherAssignment.createMany({ data: chunk });
  }
}

export async function writeAdminClassSections(
  tx: Prisma.TransactionClient,
  pairs: AdminClassSectionPair[],
  sectionMap: Map<number, number>,
  adminClassMap: Map<number, number>,
): Promise<void> {
  const resolved = pairs.map((pair) => ({
    a: requiredId(
      adminClassMap,
      pair.adminClassJwId,
      `AdminClass jwId ${pair.adminClassJwId}`,
    ),
    b: requiredId(
      sectionMap,
      pair.sectionJwId,
      `Section jwId ${pair.sectionJwId} for AdminClass jwId ${pair.adminClassJwId}`,
    ),
  }));
  const unique = uniqueBy(resolved, (pair) => `${pair.a}:${pair.b}`);
  await syncJoinPairs(
    tx,
    "_SectionAdminClasses",
    "B",
    Array.from(sectionMap.values()),
    unique,
  );
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const valueKey = key(value);
    if (seen.has(valueKey)) continue;
    seen.add(valueKey);
    result.push(value);
  }
  return result;
}
