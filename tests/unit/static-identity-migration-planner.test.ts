import { describe, expect, it } from "vitest";
import {
  buildIdentityMigrationPlan,
  type DatabaseState,
  RAW_JWID_MIGRATION_ID,
  type SnapshotState,
} from "@/static-loader/identity-migration";

const SHA = "a".repeat(64);

function snapshotState(): SnapshotState {
  return {
    sha256: SHA,
    courses: [
      { jwId: 99, code: "COURSE-OLD", nameCn: "课程旧身份" },
      {
        jwId: 101,
        code: "COURSE-1",
        nameCn: "课程一",
        legacySyntheticJwId: 1_500_000_101,
      },
    ],
    sectionCourses: [
      { sectionJwId: 201, courseJwId: 101 },
      { sectionJwId: 202, courseJwId: 101 },
    ],
    adminClasses: [
      { jwId: 301, code: "CLASS-A", nameCn: "同名班级" },
      { jwId: 302, code: "CLASS-B", nameCn: "同名班级" },
    ],
    sectionAdminClasses: [
      { sectionJwId: 201, adminClassJwId: 301 },
      { sectionJwId: 202, adminClassJwId: 302 },
    ],
    teacherTitles: [{ jwId: 401, code: "PROF", nameCn: "教授" }],
    examBatches: [
      { jwId: 501, nameCn: "期末考试" },
      { jwId: 502, nameCn: "期末考试" },
    ],
    examBatchesByExam: [
      { examJwId: 601, examBatchJwId: 501 },
      { examJwId: 602, examBatchJwId: 502 },
    ],
    departments: [{ jwId: 701, code: "CS", nameCn: "计算机学院" }],
    teachers: [
      {
        jwId: 801,
        personId: 900,
        code: "T-A",
        nameCn: "同一人",
        departmentJwId: 701,
      },
      {
        jwId: 802,
        personId: 900,
        code: "T-B",
        nameCn: "同一人",
        departmentJwId: 701,
      },
    ],
    sectionTeachers: [
      { sectionJwId: 201, teacherJwId: 801 },
      { sectionJwId: 202, teacherJwId: 802 },
    ],
    teacherAssignments: [
      { sectionJwId: 201, teacherJwId: 801, titleJwId: 401 },
      { sectionJwId: 202, teacherJwId: 802, titleJwId: 401 },
    ],
  };
}

function databaseState(): DatabaseState {
  return {
    expectedSnapshotSha256: SHA,
    globalSnapshotSha256: SHA,
    legacyIdentityConstraintsPresent: true,
    migrationState: null,
    courses: [
      {
        id: 1,
        jwId: 1_500_000_101,
        code: "COURSE-1",
        nameCn: "课程一",
        directCommentCount: 0,
        description: null,
      },
    ],
    courseAliases: [{ jwId: 99, courseId: 1 }],
    sections: [
      { id: 11, jwId: 201, courseId: 1 },
      { id: 12, jwId: 202, courseId: 1 },
    ],
    adminClasses: [{ id: 2, jwId: 301, code: "CLASS-A", nameCn: "同名班级" }],
    sectionAdminClasses: [
      { sectionId: 11, adminClassId: 2 },
      { sectionId: 12, adminClassId: 2 },
    ],
    teacherTitles: [{ id: 3, jwId: 401, code: "PROF", nameCn: "教授" }],
    examBatches: [{ id: 4, jwId: null, nameCn: "期末考试" }],
    exams: [
      { id: 41, jwId: 601, examBatchId: 4 },
      { id: 42, jwId: 602, examBatchId: 4 },
    ],
    departments: [{ id: 5, jwId: null, code: "CS", nameCn: "计算机学院" }],
    departmentReferences: [
      { ownerType: "section", ownerId: 11, departmentId: 5 },
    ],
    teachers: [
      {
        id: 6,
        jwId: null,
        teacherId: 801,
        personId: 900,
        code: "T-A",
        nameCn: "同一人",
        directCommentCount: 0,
        description: null,
      },
    ],
    sectionTeachers: [
      {
        id: 61,
        sectionId: 11,
        teacherId: 6,
        directCommentCount: 0,
      },
      {
        id: 62,
        sectionId: 12,
        teacherId: 6,
        directCommentCount: 0,
      },
    ],
    teacherAssignments: [
      {
        id: 71,
        sectionId: 11,
        teacherId: 6,
        legacyTeacherTitleId: 3,
      },
      {
        id: 72,
        sectionId: 12,
        teacherId: 6,
        legacyTeacherTitleId: 3,
      },
    ],
  };
}

describe("identity migration planner", () => {
  it("plans raw, synthetic, alias, same-name, and person-split identities", () => {
    const plan = buildIdentityMigrationPlan(snapshotState(), databaseState());

    expect(plan.mode).toBe("plan");
    expect(plan.blockers).toEqual([]);
    expect(plan.report.splitCounts).toEqual({
      courses: 1,
      adminClasses: 1,
      teachers: 1,
    });
    expect(
      plan.entityMappings.find(
        (mapping) => mapping.entity === "course" && mapping.legacyId === 1,
      ),
    ).toEqual({
      entity: "course",
      legacyId: 1,
      targetJwIds: [99, 101],
      provenance: ["alias", "synthetic"],
    });
    expect(
      plan.edgeMappings.filter((edge) => edge.entity === "sectionAdminClass"),
    ).toEqual([
      { entity: "sectionAdminClass", ownerId: 11, targetJwId: 301 },
      { entity: "sectionAdminClass", ownerId: 12, targetJwId: 302 },
    ]);
    expect(
      plan.edgeMappings.filter((edge) => edge.entity === "sectionTeacher"),
    ).toEqual([
      { entity: "sectionTeacher", ownerId: 61, targetJwId: 801 },
      { entity: "sectionTeacher", ownerId: 62, targetJwId: 802 },
    ]);
    expect(
      plan.edgeMappings.filter(
        (edge) => edge.entity === "teacherAssignmentTitle",
      ),
    ).toEqual([
      { entity: "teacherAssignmentTitle", ownerId: 71, targetJwId: 401 },
      { entity: "teacherAssignmentTitle", ownerId: 72, targetJwId: 401 },
    ]);
  });

  it("returns stable output independent of DTO ordering", () => {
    const snapshot = snapshotState();
    const database = databaseState();
    const reversedSnapshot = Object.fromEntries(
      Object.entries(snapshot).map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value].reverse() : value,
      ]),
    ) as SnapshotState;
    const reversedDatabase = Object.fromEntries(
      Object.entries(database).map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value].reverse() : value,
      ]),
    ) as DatabaseState;

    expect(
      buildIdentityMigrationPlan(reversedSnapshot, reversedDatabase),
    ).toEqual(buildIdentityMigrationPlan(snapshot, database));
  });

  it("returns a zero-operation plan for a completed migration at the same SHA", () => {
    const database = databaseState();
    database.migrationState = {
      id: RAW_JWID_MIGRATION_ID,
      snapshotSha256: SHA,
      completed: true,
    };

    expect(buildIdentityMigrationPlan(snapshotState(), database)).toMatchObject(
      {
        mode: "already-completed",
        entityMappings: [],
        edgeMappings: [],
        blockers: [],
        report: {
          blockerCount: 0,
          mappingCount: 0,
          edgeMappingCount: 0,
        },
      },
    );
  });

  it("fails closed when expected, loaded, global, or migration SHA differs", () => {
    const database = databaseState();
    database.globalSnapshotSha256 = "b".repeat(64);
    database.migrationState = {
      id: RAW_JWID_MIGRATION_ID,
      snapshotSha256: "c".repeat(64),
      completed: true,
    };

    expect(
      buildIdentityMigrationPlan(snapshotState(), database).blockers.map(
        (blocker) => blocker.code,
      ),
    ).toEqual(["MIGRATION_STATE_SHA_MISMATCH", "SNAPSHOT_STATE_SHA_MISMATCH"]);
  });

  it("requires legacy unique identities to remain through raw jwId backfill", () => {
    const database = databaseState();
    database.legacyIdentityConstraintsPresent = false;

    expect(
      buildIdentityMigrationPlan(snapshotState(), database).blockers.map(
        (blocker) => blocker.code,
      ),
    ).toContain("LEGACY_IDENTITY_CONSTRAINTS_MISSING");
  });

  it("blocks ambiguous legacy batch and department references", () => {
    const snapshot = snapshotState();
    snapshot.departments = [
      ...snapshot.departments,
      { jwId: 702, code: "CS", nameCn: "计算机学院新记录" },
    ];
    const database = databaseState();
    database.exams = [{ id: 43, jwId: 999, examBatchId: 4 }];

    expect(
      buildIdentityMigrationPlan(snapshot, database).blockers.map(
        ({ code, entity }) => ({ code, entity }),
      ),
    ).toEqual([
      { code: "LEGACY_EDGE_MULTI_TARGET", entity: "departmentEdge" },
      { code: "LEGACY_EDGE_MULTI_TARGET", entity: "examBatchEdge" },
    ]);
  });

  it("blocks alias provenance loss and multi-target teacher UGC", () => {
    const database = databaseState();
    database.courses = [{ ...database.courses[0], directCommentCount: 2 }];
    database.teachers = [{ ...database.teachers[0], directCommentCount: 1 }];

    expect(
      buildIdentityMigrationPlan(snapshotState(), database).blockers.map(
        ({ code, entity, legacyId }) => ({ code, entity, legacyId }),
      ),
    ).toEqual([
      {
        code: "COURSE_ALIAS_UGC_PROVENANCE_LOST",
        entity: "course",
        legacyId: 1,
      },
      {
        code: "UGC_MULTI_TARGET",
        entity: "teacher",
        legacyId: 6,
      },
    ]);
  });

  it("never promotes a stale CourseAlias to a snapshot target", () => {
    const snapshot = snapshotState();
    snapshot.courses = snapshot.courses.filter((course) => course.jwId !== 99);

    const plan = buildIdentityMigrationPlan(snapshot, databaseState());

    expect(plan.blockers).toContainEqual(
      expect.objectContaining({
        code: "COURSE_ALIAS_TARGET_NOT_IN_SNAPSHOT",
        legacyId: 1,
        sourceJwId: 99,
      }),
    );
    expect(
      plan.entityMappings.find(
        (mapping) => mapping.entity === "course" && mapping.legacyId === 1,
      )?.targetJwIds,
    ).toEqual([101]);
  });

  it("merges identical descriptions many-to-one but blocks different content", () => {
    const snapshot = snapshotState();
    snapshot.courses = snapshot.courses.filter((course) => course.jwId === 101);
    const database = databaseState();
    database.courseAliases = [];
    database.courses = [
      {
        ...database.courses[0],
        directCommentCount: 2,
        description: { id: "description-a", contentFingerprint: "same" },
      },
      {
        ...database.courses[0],
        id: 7,
        jwId: 101,
        directCommentCount: 3,
        description: { id: "description-b", contentFingerprint: "same" },
      },
    ];

    expect(buildIdentityMigrationPlan(snapshot, database).blockers).toEqual([]);

    database.courses = [
      database.courses[0],
      {
        ...database.courses[1],
        description: {
          id: "description-b",
          contentFingerprint: "different",
        },
      },
    ];
    expect(buildIdentityMigrationPlan(snapshot, database).blockers).toEqual([
      expect.objectContaining({
        code: "DESCRIPTION_CONFLICT",
        entity: "course",
        sourceJwId: 101,
      }),
    ]);
  });

  it("does not guess a TeacherAssignment title without a snapshot edge", () => {
    const snapshot = snapshotState();
    snapshot.teacherAssignments = snapshot.teacherAssignments.filter(
      (assignment) => assignment.sectionJwId !== 201,
    );

    expect(
      buildIdentityMigrationPlan(snapshot, databaseState()).blockers,
    ).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_EDGE_UNMAPPED",
        entity: "teacherAssignmentTitle",
        legacyId: 71,
      }),
    );
  });
});
