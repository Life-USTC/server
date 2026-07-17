import { describe, expect, it } from "vitest";
import {
  missingSnapshotRowsWhere,
  parseBooleanSetting,
  parseOptionalNonNegativeIntegerSetting,
  parseOptionalSha256Setting,
  parsePositiveIntegerSetting,
  parseSnapshotGeneratedAt,
  validateMappedSectionJwIds,
  validateSectionRetirementSnapshotApproval,
  validateSnapshotCompleteness,
} from "@/static-loader/validation";

function semesterRows(...ids: number[]) {
  return ids.map((id) => ({ id }));
}

function lessonRows(semesterId: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: semesterId * 10_000 + index,
    semester_id: semesterId,
  }));
}

function fetchRow(
  source: string,
  semesterId: number,
  options: { chunkIndex?: number; ok?: boolean } = {},
) {
  const context = new URLSearchParams();
  if (options.chunkIndex != null) {
    context.set("chunk_index", String(options.chunkIndex));
  }
  context.set("semester_id", String(semesterId));
  return {
    source,
    context: context.toString(),
    ok: options.ok === false ? 0 : 1,
  };
}

function completeFetches(semesterId: number, chunkCount: number) {
  return [
    fetchRow("catalog_teach_lesson_list_for_teach", semesterId),
    fetchRow("catalog_teach_exam_list", semesterId),
    ...Array.from({ length: chunkCount }, (_, chunkIndex) =>
      fetchRow("jw_ws_schedule_table_datum", semesterId, { chunkIndex }),
    ),
  ];
}

describe("static loader configuration", () => {
  it.each([
    [undefined, false, false],
    [undefined, true, true],
    ["true", false, true],
    ["1", false, true],
    ["FALSE", true, false],
    ["0", true, false],
  ])("parses boolean setting %s with default %s", (value, defaultValue, expected) => {
    expect(
      parseBooleanSetting("STATIC_LOADER_DRY_RUN", value, defaultValue),
    ).toBe(expected);
  });

  it("rejects an invalid boolean instead of falling back to a write-enabled default", () => {
    expect(() =>
      parseBooleanSetting("STATIC_LOADER_DRY_RUN", "treu", false),
    ).toThrow("STATIC_LOADER_DRY_RUN");
  });

  it("keeps missing-Section retirement disabled unless explicitly enabled", () => {
    expect(
      parseBooleanSetting(
        "STATIC_LOADER_RETIRE_MISSING_SECTIONS",
        undefined,
        false,
      ),
    ).toBe(false);
    expect(
      parseBooleanSetting(
        "STATIC_LOADER_RETIRE_MISSING_SECTIONS",
        "true",
        false,
      ),
    ).toBe(true);
  });

  it.each([
    [undefined, 401],
    ["401", 401],
    ["461", 461],
  ])("parses positive integer setting %s", (value, expected) => {
    expect(
      parsePositiveIntegerSetting("STATIC_LOADER_MIN_SEMESTER", value, 401),
    ).toBe(expected);
  });

  it.each([
    "",
    "401x",
    "401.5",
    "0",
    "-1",
  ])("rejects invalid positive integer %s", (value) => {
    expect(() =>
      parsePositiveIntegerSetting("STATIC_LOADER_MIN_SEMESTER", value, 401),
    ).toThrow("STATIC_LOADER_MIN_SEMESTER");
  });

  it("parses optional retirement approval settings", () => {
    expect(
      parseOptionalNonNegativeIntegerSetting(
        "STATIC_LOADER_EXPECTED_SECTION_RETIREMENT_CANDIDATES",
        "0",
      ),
    ).toBe(0);
    expect(
      parseOptionalNonNegativeIntegerSetting(
        "STATIC_LOADER_EXPECTED_SECTION_RETIREMENT_CANDIDATES",
        "",
      ),
    ).toBeNull();
    expect(
      parseOptionalSha256Setting(
        "STATIC_LOADER_EXPECTED_SNAPSHOT_SHA256",
        "A".repeat(64),
      ),
    ).toBe("a".repeat(64));
  });

  it("requires an exact snapshot approval before retirement", () => {
    expect(() =>
      validateSectionRetirementSnapshotApproval({
        enabled: true,
        expectedSnapshotSha256: null,
        snapshotSha256: "a".repeat(64),
      }),
    ).toThrow("STATIC_LOADER_EXPECTED_SNAPSHOT_SHA256");
    expect(() =>
      validateSectionRetirementSnapshotApproval({
        enabled: true,
        expectedSnapshotSha256: "b".repeat(64),
        snapshotSha256: "a".repeat(64),
      }),
    ).toThrow("does not match downloaded snapshot");
  });

  it("requires a valid snapshot generation timestamp", () => {
    expect(parseSnapshotGeneratedAt("2026-07-18T03:00:00.000Z")).toEqual(
      new Date("2026-07-18T03:00:00.000Z"),
    );
    expect(() => parseSnapshotGeneratedAt(undefined)).toThrow("required");
    expect(() => parseSnapshotGeneratedAt("not-a-date")).toThrow(
      "valid timestamp",
    );
  });
});

describe("snapshot completeness validation", () => {
  const metadata = {
    catalog_exam_min_semester_id: "381",
    jw_schedule_chunk_size: "100",
  };

  it("accepts all expected JW chunks and a zero-lesson semester", () => {
    const result = validateSnapshotCompleteness(
      {
        metadata,
        semesterRows: semesterRows(381, 401, 421),
        catalogLessonRows: [...lessonRows(401, 101), ...lessonRows(421, 0)],
        fetchRows: [...completeFetches(401, 2), ...completeFetches(421, 0)],
      },
      401,
    );

    expect(result.sectionJwIds).toHaveLength(101);
    expect(result.sectionSemesterJwIds).toEqual([401]);
  });

  it("rejects a failed JW chunk", () => {
    expect(() =>
      validateSnapshotCompleteness(
        {
          metadata,
          semesterRows: semesterRows(401),
          catalogLessonRows: lessonRows(401, 101),
          fetchRows: [
            ...completeFetches(401, 1),
            fetchRow("jw_ws_schedule_table_datum", 401, {
              chunkIndex: 1,
              ok: false,
            }),
          ],
        },
        401,
      ),
    ).toThrow("failed");
  });

  it("rejects a missing JW chunk", () => {
    expect(() =>
      validateSnapshotCompleteness(
        {
          metadata,
          semesterRows: semesterRows(401),
          catalogLessonRows: lessonRows(401, 201),
          fetchRows: completeFetches(401, 2),
        },
        401,
      ),
    ).toThrow("expected JW chunks 0,1,2");
  });

  it("rejects duplicate or extra JW chunks", () => {
    expect(() =>
      validateSnapshotCompleteness(
        {
          metadata,
          semesterRows: semesterRows(401),
          catalogLessonRows: lessonRows(401, 1),
          fetchRows: [
            ...completeFetches(401, 1),
            fetchRow("jw_ws_schedule_table_datum", 401, { chunkIndex: 1 }),
          ],
        },
        401,
      ),
    ).toThrow("expected JW chunks 0");
  });

  it("rejects expected-chunk metadata that contradicts catalog lessons", () => {
    expect(() =>
      validateSnapshotCompleteness(
        {
          metadata: {
            ...metadata,
            jw_schedule_expected_chunk_count_401: "2",
          },
          semesterRows: semesterRows(401),
          catalogLessonRows: lessonRows(401, 1),
          fetchRows: completeFetches(401, 1),
        },
        401,
      ),
    ).toThrow("expected chunk metadata");
  });

  it.each([
    "catalog_teach_lesson_list_for_teach",
    "catalog_teach_exam_list",
  ])("rejects a missing successful %s fetch", (missingSource) => {
    expect(() =>
      validateSnapshotCompleteness(
        {
          metadata,
          semesterRows: semesterRows(401),
          catalogLessonRows: lessonRows(401, 1),
          fetchRows: completeFetches(401, 1).filter(
            (row) => row.source !== missingSource,
          ),
        },
        401,
      ),
    ).toThrow(missingSource);
  });

  it("ignores semesters below the configured import boundary", () => {
    expect(() =>
      validateSnapshotCompleteness(
        {
          metadata,
          semesterRows: semesterRows(381, 401),
          catalogLessonRows: lessonRows(401, 1),
          fetchRows: completeFetches(401, 1),
        },
        401,
      ),
    ).not.toThrow();
  });

  it("rejects an in-scope lesson without a usable Section jwId", () => {
    expect(() =>
      validateSnapshotCompleteness(
        {
          metadata,
          semesterRows: semesterRows(401),
          catalogLessonRows: [{ semester_id: 401 }],
          fetchRows: completeFetches(401, 1),
        },
        401,
      ),
    ).toThrow("invalid Section jwId");
  });

  it("rejects incomplete or duplicate mapped Section sets", () => {
    expect(() => validateMappedSectionJwIds([101, 102], [101])).toThrow(
      "missing jwIds=102",
    );
    expect(() =>
      validateMappedSectionJwIds([101, 102], [101, 102, 102]),
    ).toThrow("duplicate jwIds=102");
  });
});

describe("snapshot reconciliation scope", () => {
  it("limits deletion to imported sections and preserves current IDs", () => {
    expect(missingSnapshotRowsWhere([10, 20], [101, 102])).toEqual({
      sectionId: { in: [10, 20] },
      jwId: { notIn: [101, 102] },
    });
  });

  it("deletes every scoped row when the current snapshot set is empty", () => {
    expect(missingSnapshotRowsWhere([10, 20], [])).toEqual({
      sectionId: { in: [10, 20] },
    });
  });

  it("skips reconciliation when no sections are in scope", () => {
    expect(missingSnapshotRowsWhere([], [101])).toBeUndefined();
  });
});
