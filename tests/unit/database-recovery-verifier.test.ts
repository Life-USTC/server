import { describe, expect, it, vi } from "vitest";
import {
  expectedRecoveryGuard,
  type RecoveryDatabaseClient,
  RecoveryVerificationError,
  verifyRestoredDatabase,
} from "../../scripts/verify-restored-database";

const GUARD = "unit-recovery-guard-20260718";

const counts = {
  sections: "10",
  comments: "3",
  descriptions: "2",
  homeworks: "1",
  calendarSubscriptions: "4",
  schedules: "12",
  exams: "2",
  sectionTeachers: "6",
  teacherAssignments: "6",
  sectionTeacherLinks: "6",
  scheduleTeacherLinks: "8",
};

const violations = {
  sectionsWithoutCourse: "0",
  sectionsWithoutSemester: "0",
  commentsWithInvalidTargetCount: "0",
  commentsWithMissingTarget: "0",
  descriptionsWithInvalidTargetCount: "0",
  descriptionsWithMissingTarget: "0",
  homeworksWithoutSection: "0",
  calendarSubscriptionsWithoutSection: "0",
  calendarSubscriptionsWithoutUser: "0",
  schedulesWithoutSection: "0",
  schedulesWithoutGroup: "0",
  examsWithoutSection: "0",
  sectionTeachersWithoutSection: "0",
  sectionTeachersWithoutTeacher: "0",
  teacherAssignmentsWithoutSection: "0",
  teacherAssignmentsWithoutTeacher: "0",
  sectionTeacherLinksWithoutSection: "0",
  sectionTeacherLinksWithoutTeacher: "0",
  scheduleTeacherLinksWithoutSchedule: "0",
  scheduleTeacherLinksWithoutTeacher: "0",
};

function fakeDatabase({
  guard = expectedRecoveryGuard(GUARD),
  violationOverrides = {},
}: {
  guard?: string | null;
  violationOverrides?: Partial<typeof violations>;
} = {}) {
  const statements: string[] = [];
  const queries: string[] = [];
  const rows = [
    [{ guard }],
    [counts],
    [{ ...violations, ...violationOverrides }],
  ];

  const database = {
    $transaction: async (
      operation: Parameters<RecoveryDatabaseClient["$transaction"]>[0],
    ) =>
      operation({
        $executeRawUnsafe: async (query) => {
          statements.push(query);
          return 0;
        },
        $queryRawUnsafe: async <T>(query: string) => {
          queries.push(query);
          return rows[queries.length - 1] as T;
        },
      }),
    $disconnect: vi.fn(),
  } as RecoveryDatabaseClient;

  return { database, queries, statements };
}

describe("restored database verifier", () => {
  it("checks the isolation guard before returning allowlisted aggregates", async () => {
    const { database, queries, statements } = fakeDatabase();

    const report = await verifyRestoredDatabase(
      database,
      GUARD,
      () => new Date("2026-07-18T00:00:00.000Z"),
    );

    expect(statements).toEqual(["SET TRANSACTION READ ONLY"]);
    expect(queries).toHaveLength(3);
    expect(report).toEqual({
      schemaVersion: 1,
      checkedAt: "2026-07-18T00:00:00.000Z",
      guardVerified: true,
      counts: Object.fromEntries(
        Object.entries(counts).map(([key, value]) => [key, Number(value)]),
      ),
      violations: Object.fromEntries(
        Object.entries(violations).map(([key, value]) => [key, Number(value)]),
      ),
      ok: true,
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(GUARD);
    expect(serialized).not.toMatch(
      /databaseName|connection|credential|host|url|userId|body|content/i,
    );
  });

  it("fails closed before aggregate queries when the guard does not match", async () => {
    const { database, queries } = fakeDatabase({ guard: null });

    await expect(verifyRestoredDatabase(database, GUARD)).rejects.toMatchObject(
      {
        code: "GUARD_MISMATCH",
      } satisfies Partial<RecoveryVerificationError>,
    );
    expect(queries).toHaveLength(1);
  });

  it.each([
    undefined,
    "",
    "too-short",
    "contains spaces here",
  ])("rejects an absent or unsafe guard value", async (guard) => {
    const { database, queries } = fakeDatabase();

    await expect(
      verifyRestoredDatabase(database, guard),
    ).rejects.toBeInstanceOf(RecoveryVerificationError);
    expect(queries).toHaveLength(0);
  });

  it("reports integrity violations without exposing row data", async () => {
    const { database } = fakeDatabase({
      violationOverrides: { homeworksWithoutSection: "2" },
    });

    const report = await verifyRestoredDatabase(database, GUARD);

    expect(report.ok).toBe(false);
    expect(report.violations.homeworksWithoutSection).toBe(2);
  });
});
