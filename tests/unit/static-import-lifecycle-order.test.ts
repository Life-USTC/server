/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { afterEach, describe, expect, it, vi } from "vitest";

const GENERATED_AT = "2026-07-18T03:00:00.000Z";
const SNAPSHOT_SHA = "a".repeat(64);
const { closeMock } = vi.hoisted(() => ({ closeMock: vi.fn() }));

vi.mock("@/static-loader/snapshot", () => ({
  Snapshot: class {
    close() {
      closeMock();
    }

    metadata() {
      return {
        generated_at: GENERATED_AT,
        schema_version: "5",
      };
    }

    queryAll() {
      return [];
    }

    queryGrouped() {
      return new Map();
    }
  },
}));

afterEach(() => vi.clearAllMocks());

function completedSnapshotTransaction() {
  const count = vi.fn().mockResolvedValue(0);
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    staticImportState: {
      findUnique: vi.fn().mockResolvedValue({
        snapshotGeneratedAt: new Date(GENERATED_AT),
        snapshotSha256: SNAPSHOT_SHA,
      }),
    },
    semester: { count },
    department: { count },
    course: { count },
    section: { count },
    teacher: { count },
    scheduleGroup: { count },
    schedule: { count },
    exam: { count },
    room: { count },
    building: { count },
    campus: { count },
    adminClass: { count },
  };
}

describe("repeated static import", () => {
  it("reports an already completed snapshot without running model writes again", async () => {
    const tx = completedSnapshotTransaction();
    const prisma = {
      $transaction: vi.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const { runImport } = await import("@/static-loader/import");

    const report = await runImport(prisma as never, {
      dryRun: false,
      minSemester: 401,
      snapshotPath: "/not-read.sqlite",
      snapshotSha256: SNAPSHOT_SHA,
    });

    expect(report.outcome).toBe("unchanged");
    expect(report.reconciliation.sectionPresence).toEqual({
      status: "already-applied",
    });
    expect(tx.staticImportState.findUnique).toHaveBeenCalledOnce();
    expect(closeMock).toHaveBeenCalledOnce();
  });
});
