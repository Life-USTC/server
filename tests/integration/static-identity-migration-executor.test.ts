/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { afterAll, describe, expect, it, vi } from "vitest";
import { applyIdentityMigrationPlan } from "@/static-loader/identity-migration/executor";
import { buildIdentityMigrationPlan } from "@/static-loader/identity-migration/planner";
import {
  type IdentityMigrationRunnerDependencies,
  runIdentityMigration,
} from "@/static-loader/identity-migration/runner";
import type {
  DatabaseState,
  SnapshotState,
} from "@/static-loader/identity-migration/types";
import { acquireStaticImportLock } from "@/static-loader/import-lock";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

vi.mock("bun:sqlite", () => ({ Database: class {} }));

const prisma = createTestPrisma();
const SHA = "a".repeat(64);

afterAll(() => disconnectTestPrisma(prisma));

function snapshot(
  courseJwId: number,
  legacySyntheticJwId: number,
): SnapshotState {
  return {
    sha256: SHA,
    courses: [
      {
        jwId: courseJwId,
        legacySyntheticJwIds: [legacySyntheticJwId],
        code: `MIGRATION-${courseJwId}`,
        nameCn: `迁移课程 ${courseJwId}`,
      },
    ],
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
}

function database(course: {
  id: number;
  jwId: number;
  code: string;
  nameCn: string;
}): DatabaseState {
  return {
    expectedSnapshotSha256: SHA,
    globalSnapshotSha256: SHA,
    legacyIdentityConstraintsPresent: true,
    migrationState: null,
    courses: [
      {
        ...course,
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
}

describe("identity migration executor", () => {
  it("applies a planner-produced Course identity migration atomically", async () => {
    const rollback = new Error("ROLLBACK_IDENTITY_MIGRATION_HAPPY");
    const marker = 1_700_000_000 + (Date.now() % 10_000_000);
    const rawJwId = marker + 1;
    try {
      await prisma.$transaction(async (tx) => {
        const legacy = await tx.course.create({
          data: {
            jwId: marker,
            code: `MIGRATION-${rawJwId}`,
            nameCn: `迁移课程 ${rawJwId}`,
          },
          select: { id: true, jwId: true, code: true, nameCn: true },
        });
        const secondLegacy = await tx.course.create({
          data: {
            jwId: marker + 2,
            code: `MIGRATION-${rawJwId}`,
            nameCn: `迁移课程 ${rawJwId}`,
          },
          select: { id: true, jwId: true, code: true, nameCn: true },
        });
        const emptyLegacy = await tx.course.create({
          data: {
            jwId: marker + 3,
            code: `MIGRATION-${rawJwId}`,
            nameCn: `迁移课程 ${rawJwId}`,
          },
          select: { id: true, jwId: true, code: true, nameCn: true },
        });
        const legacyCampus = await tx.campus.create({
          data: { nameCn: `迁移校区 ${marker}`, code: `C-${marker}` },
        });
        const building = await tx.building.create({
          data: {
            jwId: marker,
            nameCn: `迁移楼宇 ${marker}`,
            code: `B-${marker}`,
            campusId: legacyCampus.id,
          },
        });
        const placeholderDepartment = await tx.department.create({
          data: {
            code: `PLACEHOLDER-${marker}`,
            nameCn: `占位院系 ${marker}`,
          },
        });
        const section = await tx.section.create({
          data: {
            jwId: marker,
            code: `SECTION-${marker}`,
            courseId: legacy.id,
            openDepartmentId: placeholderDepartment.id,
          },
        });
        const sourceLessTeacher = await tx.teacher.create({
          data: { nameCn: `无来源教师 ${marker}` },
        });
        const sourceLessRelation = await tx.sectionTeacher.create({
          data: {
            sectionId: section.id,
            teacherId: sourceLessTeacher.id,
          },
        });
        const sourceLessAssignment = await tx.teacherAssignment.create({
          data: {
            sectionId: section.id,
            teacherId: sourceLessTeacher.id,
          },
        });
        await tx.$executeRawUnsafe(
          `INSERT INTO "_SectionTeachers" ("A", "B") VALUES ($1, $2)`,
          section.id,
          sourceLessTeacher.id,
        );
        const firstDescription = await tx.description.create({
          data: { courseId: legacy.id, content: "相同内容" },
        });
        const secondDescription = await tx.description.create({
          data: { courseId: secondLegacy.id, content: "相同内容" },
        });
        const emptyDescription = await tx.description.create({
          data: { courseId: emptyLegacy.id, content: "" },
        });
        await tx.descriptionEdit.createMany({
          data: [
            {
              descriptionId: firstDescription.id,
              nextContent: "相同内容",
            },
            {
              descriptionId: secondDescription.id,
              nextContent: "相同内容",
            },
          ],
        });
        const snapshotState = snapshot(rawJwId, marker);
        snapshotState.courses = [
          {
            ...snapshotState.courses[0],
            legacySyntheticJwIds: [marker, marker + 2, marker + 3],
          },
        ];
        snapshotState.campuses = [
          {
            jwId: rawJwId,
            nameCn: legacyCampus.nameCn,
            code: legacyCampus.code,
          },
        ];
        snapshotState.buildingCampuses = [
          { buildingJwId: building.jwId, campusJwId: rawJwId },
        ];
        snapshotState.sectionCourses = [
          { sectionJwId: section.jwId, courseJwId: rawJwId },
        ];
        snapshotState.departmentCodeReferences = [
          {
            ownerType: "section",
            ownerJwId: section.jwId,
            departmentCode: placeholderDepartment.code,
          },
        ];
        const databaseState = database(legacy);
        databaseState.courses = [
          {
            ...databaseState.courses[0],
            description: {
              id: firstDescription.id,
              contentFingerprint: "same-content",
            },
          },
          {
            ...secondLegacy,
            directCommentCount: 0,
            description: {
              id: secondDescription.id,
              contentFingerprint: "same-content",
            },
          },
          {
            ...emptyLegacy,
            directCommentCount: 0,
            description: {
              id: emptyDescription.id,
              contentFingerprint: "",
            },
          },
        ];
        databaseState.campuses = [legacyCampus];
        databaseState.buildings = [
          { id: building.id, jwId: building.jwId, campusId: legacyCampus.id },
        ];
        databaseState.sections = [
          {
            id: section.id,
            jwId: section.jwId,
            courseId: legacy.id,
            campusId: null,
          },
        ];
        databaseState.departments = [placeholderDepartment];
        databaseState.departmentReferences = [
          {
            ownerType: "section",
            ownerId: section.id,
            departmentId: placeholderDepartment.id,
          },
        ];
        databaseState.teachers = [
          {
            ...sourceLessTeacher,
            directCommentCount: 0,
            description: null,
          },
        ];
        databaseState.sectionTeachers = [
          {
            id: sourceLessRelation.id,
            sectionId: section.id,
            teacherId: sourceLessTeacher.id,
            directCommentCount: 0,
          },
        ];
        databaseState.sectionTeacherJoins = [
          { sectionId: section.id, teacherId: sourceLessTeacher.id },
        ];
        databaseState.teacherAssignments = [
          {
            id: sourceLessAssignment.id,
            sectionId: section.id,
            teacherId: sourceLessTeacher.id,
          },
        ];
        const plan = buildIdentityMigrationPlan(snapshotState, databaseState);
        expect(plan.blockers).toEqual([]);

        await applyIdentityMigrationPlan(
          tx,
          plan,
          snapshotState,
          databaseState,
        );

        expect(
          await tx.course.findUnique({ where: { jwId: rawJwId } }),
        ).toMatchObject({ code: `MIGRATION-${rawJwId}` });
        expect(
          await tx.course.findUnique({ where: { jwId: marker } }),
        ).toBeNull();
        expect(
          await tx.course.findUnique({ where: { jwId: marker + 2 } }),
        ).toBeNull();
        expect(
          await tx.course.findUnique({ where: { jwId: marker + 3 } }),
        ).toBeNull();
        const migratedDescriptions = await tx.description.findMany({
          where: { course: { jwId: rawJwId } },
          include: { edits: true },
        });
        expect(migratedDescriptions).toHaveLength(1);
        expect(migratedDescriptions[0].edits).toHaveLength(2);
        expect(
          await tx.building.findUnique({
            where: { id: building.id },
            select: { campus: { select: { jwId: true } } },
          }),
        ).toEqual({ campus: { jwId: rawJwId } });
        expect(
          await tx.section.findUnique({
            where: { id: section.id },
            select: {
              openDepartment: { select: { id: true, jwId: true } },
            },
          }),
        ).toEqual({
          openDepartment: { id: placeholderDepartment.id, jwId: null },
        });
        expect(
          await tx.staticIdentityMigrationState.findUnique({
            where: { id: "raw-jwid-v1" },
          }),
        ).toMatchObject({ snapshotSha256: SHA });
        expect(
          await tx.teacher.findUnique({ where: { id: sourceLessTeacher.id } }),
        ).toBeNull();
        expect(
          await tx.teacherAssignment.findUnique({
            where: { id: sourceLessAssignment.id },
          }),
        ).toBeNull();
        expect(
          await tx.sectionTeacher.findUnique({
            where: { id: sourceLessRelation.id },
          }),
        ).toBeNull();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("restores a synthetic Course from the verified catalog recovery map", async () => {
    const rollback = new Error("ROLLBACK_RECOVERED_COURSE_IDENTITY");
    const syntheticJwId = 1_623_423_958;
    const rawJwId = 143_302;
    try {
      await prisma.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: {
            jwId: syntheticJwId,
            code: "206701e",
            nameCn: "物理化学III(H)(英)",
          },
          select: { id: true, jwId: true, code: true, nameCn: true },
        });
        const snapshotState = snapshot(rawJwId, syntheticJwId);
        snapshotState.courses = [];
        const databaseState = database(course);
        const plan = buildIdentityMigrationPlan(snapshotState, databaseState);
        expect(plan.blockers).toEqual([]);

        await applyIdentityMigrationPlan(
          tx,
          plan,
          snapshotState,
          databaseState,
        );

        expect(
          await tx.course.findUnique({ where: { id: course.id } }),
        ).toMatchObject({ jwId: rawJwId });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("rejects a blocked plan before mutating the database", async () => {
    const blocked = buildIdentityMigrationPlan(
      snapshot(700_000_001, 700_000_000),
      {
        ...database({
          id: 1,
          jwId: 700_000_000,
          code: "blocked",
          nameCn: "blocked",
        }),
        legacyIdentityConstraintsPresent: false,
      },
    );
    expect(blocked.mode).toBe("blocked");

    await expect(
      applyIdentityMigrationPlan(
        prisma as never,
        blocked,
        snapshot(700_000_001, 700_000_000),
        database({
          id: 1,
          jwId: 700_000_000,
          code: "blocked",
          nameCn: "blocked",
        }),
      ),
    ).rejects.toThrow("blocked identity plan");
  });

  it("keeps sequences unchanged for a completed migration at the same SHA", async () => {
    const before = await prisma.$queryRawUnsafe<
      Array<{ lastValue: bigint; isCalled: boolean }>
    >(
      `SELECT last_value AS "lastValue", is_called AS "isCalled" FROM "Course_id_seq"`,
    );
    const completed = database({
      id: 1,
      jwId: 700_000_000,
      code: "completed",
      nameCn: "completed",
    });
    completed.courses = [];
    completed.migrationState = {
      id: "raw-jwid-v1",
      snapshotSha256: SHA,
      completed: true,
    };
    const dependencies = {
      sha256File: async () => SHA,
      readSnapshot: () => snapshot(700_000_001, 700_000_000),
      readDatabase: async () => completed,
      acquireLock: acquireStaticImportLock,
      applyPlan: applyIdentityMigrationPlan,
    } satisfies IdentityMigrationRunnerDependencies;

    const report = await runIdentityMigration(
      prisma,
      { snapshotPath: "unused.db", expectedSnapshotSha256: SHA, dryRun: false },
      dependencies,
    );
    const after = await prisma.$queryRawUnsafe<
      Array<{ lastValue: bigint; isCalled: boolean }>
    >(
      `SELECT last_value AS "lastValue", is_called AS "isCalled" FROM "Course_id_seq"`,
    );

    expect(report.outcome).toBe("already-completed");
    expect(after).toEqual(before);
  });
});
