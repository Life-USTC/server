/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { afterEach, describe, expect, it, vi } from "vitest";

const { closeMock, queryAllMock, transactionMock } = vi.hoisted(() => ({
  closeMock: vi.fn(),
  queryAllMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/static-loader/snapshot", () => ({
  Snapshot: class {
    close() {
      closeMock();
    }

    metadata() {
      return {
        generated_at: "2099-01-01T00:00:00.000Z",
        schema_version: "5",
      };
    }

    queryAll() {
      return queryAllMock();
    }
  },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("static loader snapshot time gate", () => {
  it("rejects a far-future snapshot before writes when retirement is disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T03:00:00.000Z"));
    const { runImport } = await import("@/static-loader/import");

    await expect(
      runImport(
        {
          $transaction: transactionMock,
        } as never,
        {
          dryRun: false,
          expectedSectionRetirementCandidates: null,
          expectedSnapshotSha256: null,
          minSemester: 401,
          retireMissingSections: false,
          snapshotPath: "/not-read.sqlite",
          snapshotSha256: "a".repeat(64),
        },
      ),
    ).rejects.toThrow(
      "snapshot metadata generated_at must not be more than 15 minutes in the future",
    );

    expect(queryAllMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledOnce();
  });
});
