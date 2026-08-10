import { describe, expect, it, vi } from "vitest";
import type { IdentityMigrationSql } from "@/static-loader/identity-migration/database-reader";
import { applyIdentityMigrationPlan } from "@/static-loader/identity-migration/executor";
import type {
  DatabaseState,
  IdentityMigrationPlan,
  SnapshotState,
} from "@/static-loader/identity-migration/types";

const SHA = "a".repeat(64);

describe("static identity migration executor", () => {
  it("updates a large edge set with one set-based statement", async () => {
    const execute = vi.fn(async (..._args: unknown[]) => 1);
    const query = vi.fn(async (sql: string, ..._args: unknown[]) => {
      if (sql.includes("information_schema.columns"))
        return [{ present: true }];
      if (sql.includes('FROM "Course"')) return [{ id: 10, jwId: 100 }];
      return [];
    });
    const tx = {
      $executeRawUnsafe: execute,
      $queryRawUnsafe: query,
    } as unknown as IdentityMigrationSql;
    const edgeMappings = Array.from({ length: 20_000 }, (_, index) => ({
      entity: "sectionCourse" as const,
      ownerId: index + 1,
      targetJwId: 100,
    }));
    const plan: IdentityMigrationPlan = {
      migrationId: "raw-jwid-v1",
      snapshotSha256: SHA,
      mode: "plan",
      entityMappings: [
        {
          entity: "course",
          legacyId: 1,
          targetJwIds: [100],
          provenance: ["synthetic"],
        },
      ],
      edgeMappings,
      blockers: [],
      report: {
        snapshotSha256: SHA,
        mode: "plan",
        blockerCount: 0,
        mappingCount: 1,
        edgeMappingCount: edgeMappings.length,
        splitCounts: {
          courses: 0,
          adminClasses: 0,
          teachers: 0,
          retainedDepartmentPlaceholders: 0,
        },
      },
    };
    const snapshot: SnapshotState = {
      sha256: SHA,
      courses: [{ jwId: 100, code: "TEST100", nameCn: "测试课程" }],
      sectionCourses: [],
      adminClasses: [],
      sectionAdminClasses: [],
      teacherTitles: [],
      examBatches: [],
      examBatchesByExam: [],
      departments: [],
      departmentCodeReferences: [],
      campuses: [],
      buildingCampuses: [],
      sectionCampuses: [],
      teachers: [],
      sectionTeachers: [],
      teacherAssignments: [],
    };
    const database: DatabaseState = {
      expectedSnapshotSha256: SHA,
      globalSnapshotSha256: SHA,
      legacyIdentityConstraintsPresent: true,
      migrationState: null,
      courses: [
        {
          id: 1,
          jwId: 1_500_000_001,
          code: "TEST100",
          nameCn: "测试课程",
          directCommentCount: 0,
          description: null,
        },
      ],
      sections: [],
      adminClasses: [],
      sectionAdminClasses: [],
      teacherTitles: [],
      examBatches: [],
      exams: [],
      departments: [],
      campuses: [],
      buildings: [],
      departmentReferences: [],
      teachers: [],
      sectionTeachers: [],
      sectionTeacherJoins: [],
      teacherAssignments: [],
      scheduleTeachers: [],
    };

    await applyIdentityMigrationPlan(tx, plan, snapshot, database);

    const updates = execute.mock.calls.filter(([sql]) =>
      String(sql).includes('UPDATE "Section" target SET "courseId"'),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]?.[1]).toHaveLength(edgeMappings.length);
    expect(updates[0]?.[2]).toHaveLength(edgeMappings.length);
  });
});
