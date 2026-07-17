import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma-node/client";

const GUARD_PREFIX = "life-ustc-recovery-drill:";
const GUARD_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;

const COUNT_KEYS = [
  "sections",
  "comments",
  "descriptions",
  "homeworks",
  "calendarSubscriptions",
  "schedules",
  "exams",
  "sectionTeachers",
  "teacherAssignments",
  "sectionTeacherLinks",
  "scheduleTeacherLinks",
] as const;

const VIOLATION_KEYS = [
  "sectionsWithoutCourse",
  "sectionsWithoutSemester",
  "commentsWithInvalidTargetCount",
  "commentsWithMissingTarget",
  "descriptionsWithInvalidTargetCount",
  "descriptionsWithMissingTarget",
  "homeworksWithoutSection",
  "calendarSubscriptionsWithoutSection",
  "calendarSubscriptionsWithoutUser",
  "schedulesWithoutSection",
  "schedulesWithoutGroup",
  "examsWithoutSection",
  "sectionTeachersWithoutSection",
  "sectionTeachersWithoutTeacher",
  "teacherAssignmentsWithoutSection",
  "teacherAssignmentsWithoutTeacher",
  "sectionTeacherLinksWithoutSection",
  "sectionTeacherLinksWithoutTeacher",
  "scheduleTeacherLinksWithoutSchedule",
  "scheduleTeacherLinksWithoutTeacher",
] as const;

type CountKey = (typeof COUNT_KEYS)[number];
type ViolationKey = (typeof VIOLATION_KEYS)[number];
type AggregateRow = Record<string, bigint | number | string | null | undefined>;

export type RecoveryVerificationReport = {
  schemaVersion: 1;
  checkedAt: string;
  guardVerified: true;
  counts: Record<CountKey, number>;
  violations: Record<ViolationKey, number>;
  ok: boolean;
};

export type RecoveryQueryClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export type RecoveryDatabaseClient = {
  $transaction<T>(
    operation: (transaction: RecoveryQueryClient) => Promise<T>,
    options?: {
      isolationLevel?: "RepeatableRead";
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T>;
  $disconnect(): Promise<void>;
};

export class RecoveryVerificationError extends Error {
  constructor(
    readonly code:
      | "CONFIGURATION_MISSING"
      | "GUARD_INVALID"
      | "GUARD_MISMATCH"
      | "INTEGRITY_VIOLATIONS",
  ) {
    super(code);
    this.name = "RecoveryVerificationError";
  }
}

const GUARD_QUERY = `
  SELECT shobj_description(database.oid, 'pg_database') AS "guard"
  FROM pg_database AS database
  WHERE database.datname = current_database()
`;

const COUNTS_QUERY = `
  SELECT
    (SELECT COUNT(*)::text FROM "Section") AS "sections",
    (SELECT COUNT(*)::text FROM "Comment") AS "comments",
    (SELECT COUNT(*)::text FROM "Description") AS "descriptions",
    (SELECT COUNT(*)::text FROM "Homework") AS "homeworks",
    (SELECT COUNT(*)::text FROM "_UserCalendarSections") AS "calendarSubscriptions",
    (SELECT COUNT(*)::text FROM "Schedule") AS "schedules",
    (SELECT COUNT(*)::text FROM "Exam") AS "exams",
    (SELECT COUNT(*)::text FROM "SectionTeacher") AS "sectionTeachers",
    (SELECT COUNT(*)::text FROM "TeacherAssignment") AS "teacherAssignments",
    (SELECT COUNT(*)::text FROM "_SectionTeachers") AS "sectionTeacherLinks",
    (SELECT COUNT(*)::text FROM "_ScheduleTeachers") AS "scheduleTeacherLinks"
`;

const VIOLATIONS_QUERY = `
  SELECT
    (
      SELECT COUNT(*)::text
      FROM "Section" AS section
      LEFT JOIN "Course" AS course ON course.id = section."courseId"
      WHERE course.id IS NULL
    ) AS "sectionsWithoutCourse",
    (
      SELECT COUNT(*)::text
      FROM "Section" AS section
      LEFT JOIN "Semester" AS semester ON semester.id = section."semesterId"
      WHERE section."semesterId" IS NOT NULL AND semester.id IS NULL
    ) AS "sectionsWithoutSemester",
    (
      SELECT COUNT(*)::text
      FROM "Comment"
      WHERE num_nonnulls(
        "sectionId",
        "courseId",
        "teacherId",
        "sectionTeacherId",
        "homeworkId"
      ) <> 1
    ) AS "commentsWithInvalidTargetCount",
    (
      SELECT COUNT(*)::text
      FROM "Comment" AS comment
      LEFT JOIN "Section" AS section ON section.id = comment."sectionId"
      LEFT JOIN "Course" AS course ON course.id = comment."courseId"
      LEFT JOIN "Teacher" AS teacher ON teacher.id = comment."teacherId"
      LEFT JOIN "SectionTeacher" AS section_teacher
        ON section_teacher.id = comment."sectionTeacherId"
      LEFT JOIN "Homework" AS homework ON homework.id = comment."homeworkId"
      WHERE
        (comment."sectionId" IS NOT NULL AND section.id IS NULL)
        OR (comment."courseId" IS NOT NULL AND course.id IS NULL)
        OR (comment."teacherId" IS NOT NULL AND teacher.id IS NULL)
        OR (
          comment."sectionTeacherId" IS NOT NULL
          AND section_teacher.id IS NULL
        )
        OR (comment."homeworkId" IS NOT NULL AND homework.id IS NULL)
    ) AS "commentsWithMissingTarget",
    (
      SELECT COUNT(*)::text
      FROM "Description"
      WHERE num_nonnulls(
        "sectionId",
        "courseId",
        "teacherId",
        "homeworkId"
      ) <> 1
    ) AS "descriptionsWithInvalidTargetCount",
    (
      SELECT COUNT(*)::text
      FROM "Description" AS description
      LEFT JOIN "Section" AS section ON section.id = description."sectionId"
      LEFT JOIN "Course" AS course ON course.id = description."courseId"
      LEFT JOIN "Teacher" AS teacher ON teacher.id = description."teacherId"
      LEFT JOIN "Homework" AS homework ON homework.id = description."homeworkId"
      WHERE
        (description."sectionId" IS NOT NULL AND section.id IS NULL)
        OR (description."courseId" IS NOT NULL AND course.id IS NULL)
        OR (description."teacherId" IS NOT NULL AND teacher.id IS NULL)
        OR (description."homeworkId" IS NOT NULL AND homework.id IS NULL)
    ) AS "descriptionsWithMissingTarget",
    (
      SELECT COUNT(*)::text
      FROM "Homework" AS homework
      LEFT JOIN "Section" AS section ON section.id = homework."sectionId"
      WHERE section.id IS NULL
    ) AS "homeworksWithoutSection",
    (
      SELECT COUNT(*)::text
      FROM "_UserCalendarSections" AS subscription
      LEFT JOIN "Section" AS section ON section.id = subscription."A"
      WHERE section.id IS NULL
    ) AS "calendarSubscriptionsWithoutSection",
    (
      SELECT COUNT(*)::text
      FROM "_UserCalendarSections" AS subscription
      LEFT JOIN "User" AS app_user ON app_user.id = subscription."B"
      WHERE app_user.id IS NULL
    ) AS "calendarSubscriptionsWithoutUser",
    (
      SELECT COUNT(*)::text
      FROM "Schedule" AS schedule
      LEFT JOIN "Section" AS section ON section.id = schedule."sectionId"
      WHERE section.id IS NULL
    ) AS "schedulesWithoutSection",
    (
      SELECT COUNT(*)::text
      FROM "Schedule" AS schedule
      LEFT JOIN "ScheduleGroup" AS schedule_group
        ON schedule_group.id = schedule."scheduleGroupId"
      WHERE schedule_group.id IS NULL
    ) AS "schedulesWithoutGroup",
    (
      SELECT COUNT(*)::text
      FROM "Exam" AS exam
      LEFT JOIN "Section" AS section ON section.id = exam."sectionId"
      WHERE section.id IS NULL
    ) AS "examsWithoutSection",
    (
      SELECT COUNT(*)::text
      FROM "SectionTeacher" AS section_teacher
      LEFT JOIN "Section" AS section ON section.id = section_teacher."sectionId"
      WHERE section.id IS NULL
    ) AS "sectionTeachersWithoutSection",
    (
      SELECT COUNT(*)::text
      FROM "SectionTeacher" AS section_teacher
      LEFT JOIN "Teacher" AS teacher ON teacher.id = section_teacher."teacherId"
      WHERE teacher.id IS NULL
    ) AS "sectionTeachersWithoutTeacher",
    (
      SELECT COUNT(*)::text
      FROM "TeacherAssignment" AS assignment
      LEFT JOIN "Section" AS section ON section.id = assignment."sectionId"
      WHERE section.id IS NULL
    ) AS "teacherAssignmentsWithoutSection",
    (
      SELECT COUNT(*)::text
      FROM "TeacherAssignment" AS assignment
      LEFT JOIN "Teacher" AS teacher ON teacher.id = assignment."teacherId"
      WHERE teacher.id IS NULL
    ) AS "teacherAssignmentsWithoutTeacher",
    (
      SELECT COUNT(*)::text
      FROM "_SectionTeachers" AS relation
      LEFT JOIN "Section" AS section ON section.id = relation."A"
      WHERE section.id IS NULL
    ) AS "sectionTeacherLinksWithoutSection",
    (
      SELECT COUNT(*)::text
      FROM "_SectionTeachers" AS relation
      LEFT JOIN "Teacher" AS teacher ON teacher.id = relation."B"
      WHERE teacher.id IS NULL
    ) AS "sectionTeacherLinksWithoutTeacher",
    (
      SELECT COUNT(*)::text
      FROM "_ScheduleTeachers" AS relation
      LEFT JOIN "Schedule" AS schedule ON schedule.id = relation."A"
      WHERE schedule.id IS NULL
    ) AS "scheduleTeacherLinksWithoutSchedule",
    (
      SELECT COUNT(*)::text
      FROM "_ScheduleTeachers" AS relation
      LEFT JOIN "Teacher" AS teacher ON teacher.id = relation."B"
      WHERE teacher.id IS NULL
    ) AS "scheduleTeacherLinksWithoutTeacher"
`;

function requireGuardValue(value: string | undefined): string {
  if (!value) {
    throw new RecoveryVerificationError("CONFIGURATION_MISSING");
  }
  if (!GUARD_VALUE_PATTERN.test(value)) {
    throw new RecoveryVerificationError("GUARD_INVALID");
  }
  return value;
}

export function expectedRecoveryGuard(value: string): string {
  return `${GUARD_PREFIX}${requireGuardValue(value)}`;
}

function parseAggregateRow<const Keys extends readonly string[]>(
  row: AggregateRow | undefined,
  keys: Keys,
): Record<Keys[number], number> {
  if (!row) {
    throw new Error("Aggregate query returned no rows");
  }

  return Object.fromEntries(
    keys.map((key) => {
      const rawValue = row[key];
      const text = typeof rawValue === "bigint" ? `${rawValue}` : rawValue;
      if (
        (typeof text !== "string" && typeof text !== "number") ||
        !/^\d+$/.test(`${text}`)
      ) {
        throw new Error("Aggregate query returned an invalid count");
      }

      const value = Number(text);
      if (!Number.isSafeInteger(value)) {
        throw new Error("Aggregate query returned an unsafe count");
      }
      return [key, value];
    }),
  ) as Record<Keys[number], number>;
}

async function assertRecoveryGuard(
  transaction: RecoveryQueryClient,
  guardValue: string,
) {
  const rows =
    await transaction.$queryRawUnsafe<Array<{ guard: string | null }>>(
      GUARD_QUERY,
    );
  if (rows[0]?.guard !== expectedRecoveryGuard(guardValue)) {
    throw new RecoveryVerificationError("GUARD_MISMATCH");
  }
}

export async function verifyRestoredDatabase(
  database: RecoveryDatabaseClient,
  guardValue: string | undefined,
  now: () => Date = () => new Date(),
): Promise<RecoveryVerificationReport> {
  const requiredGuard = requireGuardValue(guardValue);

  return database.$transaction(
    async (transaction) => {
      await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await assertRecoveryGuard(transaction, requiredGuard);

      const countRows =
        await transaction.$queryRawUnsafe<AggregateRow[]>(COUNTS_QUERY);
      const violationRows =
        await transaction.$queryRawUnsafe<AggregateRow[]>(VIOLATIONS_QUERY);
      const counts = parseAggregateRow(countRows[0], COUNT_KEYS);
      const violations = parseAggregateRow(violationRows[0], VIOLATION_KEYS);

      return {
        schemaVersion: 1,
        checkedAt: now().toISOString(),
        guardVerified: true,
        counts,
        violations,
        ok: Object.values(violations).every((value) => value === 0),
      };
    },
    {
      isolationLevel: "RepeatableRead",
      maxWait: 10_000,
      timeout: 120_000,
    },
  );
}

async function run() {
  const connectionString = process.env.RECOVERY_DATABASE_URL;
  if (!connectionString) {
    throw new RecoveryVerificationError("CONFIGURATION_MISSING");
  }

  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  }) as unknown as RecoveryDatabaseClient;

  try {
    const report = await verifyRestoredDatabase(
      database,
      process.env.RECOVERY_DRILL_GUARD,
    );
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      throw new RecoveryVerificationError("INTEGRITY_VIOLATIONS");
    }
  } finally {
    await database.$disconnect();
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    const code =
      error instanceof RecoveryVerificationError
        ? error.code
        : "UNEXPECTED_ERROR";
    console.error(`Recovery database verification failed: ${code}`);
    process.exitCode = 1;
  });
}
