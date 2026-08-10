/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma-node/client";
import type { IdentityMigrationSql } from "@/static-loader/identity-migration/database-reader";
import {
  IdentityMigrationBlockedError,
  type IdentityMigrationRunnerDependencies,
  runIdentityMigration,
} from "@/static-loader/identity-migration/runner";
import type {
  DatabaseState,
  SnapshotState,
} from "@/static-loader/identity-migration/types";

vi.mock("bun:sqlite", () => ({ Database: class {} }));

const SHA = "a".repeat(64);

function emptySnapshot(): SnapshotState {
  return {
    sha256: SHA,
    courses: [],
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

function emptyDatabase(): DatabaseState {
  return {
    expectedSnapshotSha256: SHA,
    globalSnapshotSha256: SHA,
    legacyIdentityConstraintsPresent: true,
    migrationState: null,
    courses: [],
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

function harness(database: DatabaseState) {
  const events: string[] = [];
  let applyCalls = 0;
  const tx: IdentityMigrationSql = {
    $queryRawUnsafe: async <T>() => [] as T,
    $executeRawUnsafe: async (query) => {
      events.push(query);
      return 0;
    },
  };
  const prisma = {
    $transaction: async (
      action: (transaction: IdentityMigrationSql) => Promise<unknown>,
    ) => action(tx),
  } as unknown as PrismaClient;
  const dependencies = {
    sha256File: async () => SHA,
    readSnapshot: () => emptySnapshot(),
    acquireLock: async () => {
      events.push("lock");
    },
    readDatabase: async () => {
      events.push("read");
      return database;
    },
    applyPlan: async () => {
      applyCalls += 1;
      return { createdTargets: 0, rebuiltEdges: 0, deletedLegacyRows: 0 };
    },
  } satisfies IdentityMigrationRunnerDependencies;
  return {
    events,
    prisma,
    dependencies,
    applyCalls: () => applyCalls,
  };
}

describe("identity migration runner", () => {
  it("starts dry-run as a real read-only transaction before locking or reading", async () => {
    const test = harness(emptyDatabase());

    const report = await runIdentityMigration(
      test.prisma,
      {
        snapshotPath: "snapshot.db",
        expectedSnapshotSha256: SHA,
        dryRun: true,
      },
      test.dependencies,
    );

    expect(report.outcome).toBe("planned");
    expect(test.events).toEqual(["SET TRANSACTION READ ONLY", "lock", "read"]);
    expect(test.applyCalls()).toBe(0);
  });

  it("does not enter the executor when planning is blocked", async () => {
    const database = emptyDatabase();
    database.legacyIdentityConstraintsPresent = false;
    const test = harness(database);

    await expect(
      runIdentityMigration(
        test.prisma,
        {
          snapshotPath: "snapshot.db",
          expectedSnapshotSha256: SHA,
          dryRun: false,
        },
        test.dependencies,
      ),
    ).rejects.toBeInstanceOf(IdentityMigrationBlockedError);
    expect(test.applyCalls()).toBe(0);
  });

  it("fails a blocked dry-run instead of reporting it as planned", async () => {
    const database = emptyDatabase();
    database.legacyIdentityConstraintsPresent = false;
    const test = harness(database);

    await expect(
      runIdentityMigration(
        test.prisma,
        {
          snapshotPath: "snapshot.db",
          expectedSnapshotSha256: SHA,
          dryRun: true,
        },
        test.dependencies,
      ),
    ).rejects.toBeInstanceOf(IdentityMigrationBlockedError);
    expect(test.events).toEqual(["SET TRANSACTION READ ONLY", "lock", "read"]);
    expect(test.applyCalls()).toBe(0);
  });

  it("returns same-SHA completed as a zero-write operation", async () => {
    const database = emptyDatabase();
    database.migrationState = {
      id: "raw-jwid-v1",
      snapshotSha256: SHA,
      completed: true,
    };
    const test = harness(database);

    const report = await runIdentityMigration(
      test.prisma,
      {
        snapshotPath: "snapshot.db",
        expectedSnapshotSha256: SHA,
        dryRun: false,
      },
      test.dependencies,
    );

    expect(report.outcome).toBe("already-completed");
    expect(test.events).toEqual(["lock", "read"]);
    expect(test.applyCalls()).toBe(0);
  });

  it("rejects a file SHA mismatch before opening a database transaction", async () => {
    const test = harness(emptyDatabase());
    test.dependencies.sha256File = async () => "b".repeat(64);

    await expect(
      runIdentityMigration(
        test.prisma,
        {
          snapshotPath: "snapshot.db",
          expectedSnapshotSha256: SHA,
          dryRun: false,
        },
        test.dependencies,
      ),
    ).rejects.toThrow("does not match file SHA-256");
    expect(test.events).toEqual([]);
  });
});
