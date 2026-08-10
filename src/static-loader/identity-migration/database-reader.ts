import { createHash } from "node:crypto";
import type { DatabaseState, LegacyDescription } from "./types";

export type IdentityMigrationSql = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

type DescriptionRow = {
  id: string;
  content: string;
  courseId: number | null;
  teacherId: number | null;
  hasUserHistory: boolean;
};

export async function readIdentityMigrationDatabase(
  tx: IdentityMigrationSql,
  expectedSnapshotSha256: string,
): Promise<DatabaseState> {
  const [
    globalStates,
    migrationStates,
    constraintRows,
    courses,
    sections,
    adminClasses,
    sectionAdminClasses,
    teacherTitles,
    examBatches,
    exams,
    departments,
    campuses,
    buildings,
    departmentReferences,
    teachers,
    sectionTeachers,
    sectionTeacherJoins,
    teacherAssignments,
    scheduleTeachers,
    descriptions,
    courseCommentCounts,
    teacherCommentCounts,
    sectionTeacherCommentCounts,
  ] = await Promise.all([
    tx.$queryRawUnsafe<Array<{ snapshotSha256: string }>>(
      `SELECT "snapshotSha256" FROM "StaticImportState" WHERE "id" = 'global'`,
    ),
    tx.$queryRawUnsafe<
      Array<{ id: string; snapshotSha256: string; completedAt: Date }>
    >(
      `SELECT "id", "snapshotSha256", "completedAt" FROM "StaticIdentityMigrationState" WHERE "id" = 'raw-jwid-v1'`,
    ),
    tx.$queryRawUnsafe<
      Array<{
        adminClass: boolean;
        department: boolean;
        examBatch: boolean;
        teacherTitle: boolean;
        campus: boolean;
      }>
    >(`SELECT
      to_regclass('"AdminClass_nameCn_key"') IS NOT NULL AS "adminClass",
      to_regclass('"Department_code_key"') IS NOT NULL AS "department",
      to_regclass('"ExamBatch_nameCn_key"') IS NOT NULL AS "examBatch",
      to_regclass('"TeacherTitle_nameCn_key"') IS NOT NULL AS "teacherTitle",
      to_regclass('"Campus_nameCn_key"') IS NOT NULL AS "campus"`),
    tx.$queryRawUnsafe<
      Array<{ id: number; jwId: number; code: string; nameCn: string }>
    >(`SELECT "id", "jwId", "code", "nameCn" FROM "Course"`),
    tx.$queryRawUnsafe<
      Array<{
        id: number;
        jwId: number;
        courseId: number;
        campusId: number | null;
      }>
    >(`SELECT "id", "jwId", "courseId", "campusId" FROM "Section"`),
    tx.$queryRawUnsafe<
      Array<{
        id: number;
        jwId: number | null;
        code: string | null;
        nameCn: string;
      }>
    >(`SELECT "id", "jwId", "code", "nameCn" FROM "AdminClass"`),
    tx.$queryRawUnsafe<Array<{ sectionId: number; adminClassId: number }>>(
      `SELECT "B" AS "sectionId", "A" AS "adminClassId" FROM "_SectionAdminClasses"`,
    ),
    tx.$queryRawUnsafe<
      Array<{
        id: number;
        jwId: number;
        code: string;
        nameCn: string;
      }>
    >(`SELECT "id", "jwId", "code", "nameCn" FROM "TeacherTitle"`),
    tx.$queryRawUnsafe<
      Array<{ id: number; jwId: number | null; nameCn: string }>
    >(`SELECT "id", "jwId", "nameCn" FROM "ExamBatch"`),
    tx.$queryRawUnsafe<
      Array<{ id: number; jwId: number; examBatchId: number | null }>
    >(`SELECT "id", "jwId", "examBatchId" FROM "Exam"`),
    tx.$queryRawUnsafe<
      Array<{
        id: number;
        jwId: number | null;
        code: string;
        nameCn: string;
      }>
    >(`SELECT "id", "jwId", "code", "nameCn" FROM "Department"`),
    tx.$queryRawUnsafe<
      Array<{
        id: number;
        jwId: number | null;
        code: string | null;
        nameCn: string;
      }>
    >(`SELECT "id", "jwId", "code", "nameCn" FROM "Campus"`),
    tx.$queryRawUnsafe<
      Array<{ id: number; jwId: number; campusId: number | null }>
    >(`SELECT "id", "jwId", "campusId" FROM "Building"`),
    tx.$queryRawUnsafe<
      Array<{
        ownerType: "section" | "teacher";
        ownerId: number;
        departmentId: number;
      }>
    >(`SELECT 'section'::text AS "ownerType", "id" AS "ownerId", "openDepartmentId" AS "departmentId"
       FROM "Section" WHERE "openDepartmentId" IS NOT NULL
       UNION ALL
       SELECT 'teacher'::text, "id", "departmentId"
       FROM "Teacher" WHERE "departmentId" IS NOT NULL`),
    tx.$queryRawUnsafe<
      Array<{
        id: number;
        jwId: number | null;
        personId: number | null;
        teacherId: number | null;
        code: string | null;
        nameCn: string;
      }>
    >(
      `SELECT "id", "jwId", "personId", "teacherId", "code", "nameCn" FROM "Teacher"`,
    ),
    tx.$queryRawUnsafe<
      Array<{ id: number; sectionId: number; teacherId: number }>
    >(`SELECT "id", "sectionId", "teacherId" FROM "SectionTeacher"`),
    tx.$queryRawUnsafe<Array<{ sectionId: number; teacherId: number }>>(
      `SELECT "A" AS "sectionId", "B" AS "teacherId" FROM "_SectionTeachers"`,
    ),
    tx.$queryRawUnsafe<
      Array<{
        id: number;
        sectionId: number;
        teacherId: number;
      }>
    >(`SELECT "id", "sectionId", "teacherId" FROM "TeacherAssignment"`),
    tx.$queryRawUnsafe<
      Array<{ scheduleId: number; sectionId: number; teacherId: number }>
    >(`SELECT st."A" AS "scheduleId", s."sectionId", st."B" AS "teacherId"
       FROM "_ScheduleTeachers" st
       JOIN "Schedule" s ON s."id" = st."A"`),
    tx.$queryRawUnsafe<DescriptionRow[]>(
      `SELECT d."id", d."content", d."courseId", d."teacherId",
              (d."lastEditedAt" IS NOT NULL OR EXISTS (
                SELECT 1 FROM "DescriptionEdit" de WHERE de."descriptionId" = d."id"
              )) AS "hasUserHistory"
       FROM "Description" d
       WHERE d."courseId" IS NOT NULL OR d."teacherId" IS NOT NULL`,
    ),
    countBy(tx, "courseId", `"Comment"`, `"courseId" IS NOT NULL`),
    countBy(tx, "teacherId", `"Comment"`, `"teacherId" IS NOT NULL`),
    countBy(
      tx,
      "sectionTeacherId",
      `"Comment"`,
      `"sectionTeacherId" IS NOT NULL`,
    ),
  ]);

  const descriptionByCourse = new Map<number, LegacyDescription>();
  const descriptionByTeacher = new Map<number, LegacyDescription>();
  for (const row of descriptions) {
    const description = {
      id: row.id,
      contentFingerprint: descriptionContentFingerprint(
        row.content,
        row.hasUserHistory,
      ),
    };
    if (row.courseId != null)
      descriptionByCourse.set(row.courseId, description);
    if (row.teacherId != null) {
      descriptionByTeacher.set(row.teacherId, description);
    }
  }
  const constraints = constraintRows[0];

  return {
    expectedSnapshotSha256,
    globalSnapshotSha256: globalStates[0]?.snapshotSha256 ?? null,
    legacyIdentityConstraintsPresent:
      constraints?.adminClass === true &&
      constraints.department === true &&
      constraints.examBatch === true &&
      constraints.teacherTitle === true &&
      constraints.campus === true,
    migrationState:
      migrationStates[0] == null
        ? null
        : {
            id: migrationStates[0].id,
            snapshotSha256: migrationStates[0].snapshotSha256,
            completed: migrationStates[0].completedAt != null,
          },
    courses: courses.map((row) => ({
      ...row,
      directCommentCount: courseCommentCounts.get(row.id) ?? 0,
      description: descriptionByCourse.get(row.id) ?? null,
    })),
    sections,
    adminClasses,
    sectionAdminClasses,
    teacherTitles,
    examBatches,
    exams,
    departments,
    campuses,
    buildings,
    departmentReferences,
    teachers: teachers.map((row) => ({
      ...row,
      directCommentCount: teacherCommentCounts.get(row.id) ?? 0,
      description: descriptionByTeacher.get(row.id) ?? null,
    })),
    sectionTeachers: sectionTeachers.map((row) => ({
      ...row,
      directCommentCount: sectionTeacherCommentCounts.get(row.id) ?? 0,
    })),
    sectionTeacherJoins,
    teacherAssignments,
    scheduleTeachers,
  };
}

export function descriptionContentFingerprint(
  content: string,
  hasUserHistory: boolean,
) {
  if (content === "" && !hasUserHistory) return "";
  return createHash("sha256").update(content).digest("hex");
}

async function countBy(
  tx: IdentityMigrationSql,
  column: string,
  table: string,
  where: string,
) {
  const rows = await tx.$queryRawUnsafe<
    Array<{ ownerId: number; count: bigint | number }>
  >(
    `SELECT "${column}" AS "ownerId", count(*) AS "count" FROM ${table} WHERE ${where} GROUP BY "${column}"`,
  );
  return new Map(rows.map((row) => [row.ownerId, Number(row.count)]));
}
