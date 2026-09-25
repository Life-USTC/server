import { describe, expect, it } from "vitest";
import {
  missingSnapshotRowsWhere,
  parseBooleanSetting,
  parsePositiveIntegerSetting,
  parseSnapshotGeneratedAt,
  validateMappedSectionJwIds,
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
  ])(
    "parses boolean setting %s with default %s",
    (value, defaultValue, expected) => {
      expect(
        parseBooleanSetting("STATIC_LOADER_DRY_RUN", value, defaultValue),
      ).toBe(expected);
    },
  );

  it("rejects an invalid boolean instead of falling back to a write-enabled default", () => {
    expect(() =>
      parseBooleanSetting("STATIC_LOADER_DRY_RUN", "treu", false),
    ).toThrow("STATIC_LOADER_DRY_RUN");
  });

  it.each([
    [undefined, 401],
    ["401", 401],
    ["461", 461],
  ])("parses positive integer setting %s", (value, expected) => {
    expect(
      parsePositiveIntegerSetting("catalog_lesson_min_semester_id", value, 401),
    ).toBe(expected);
  });

  it.each(["", "401x", "401.5", "0", "-1"])(
    "rejects invalid positive integer %s",
    (value) => {
      expect(() =>
        parsePositiveIntegerSetting(
          "catalog_lesson_min_semester_id",
          value,
          401,
        ),
      ).toThrow("catalog_lesson_min_semester_id");
    },
  );

  it("requires a valid snapshot generation timestamp", () => {
    const now = new Date("2026-07-18T03:00:00.000Z");
    expect(parseSnapshotGeneratedAt("2026-07-18T03:00:00.000Z", now)).toEqual(
      new Date("2026-07-18T03:00:00.000Z"),
    );
    expect(
      parseSnapshotGeneratedAt("2026-07-18T03:00:00.123456+00:00", now),
    ).toEqual(new Date("2026-07-18T03:00:00.123Z"));
    expect(() => parseSnapshotGeneratedAt(undefined, now)).toThrow("required");
    expect(() => parseSnapshotGeneratedAt("not-a-date", now)).toThrow(
      "valid timestamp",
    );
  });

  it.each([
    "2026-02-30T03:00:00.000Z",
    "2026-07-18 03:00:00.000Z",
    "2026-07-18T03:00Z",
    "2026-07-18T03:00:00.000",
  ])("rejects non-RFC 3339 snapshot timestamp %s", (value) => {
    expect(() =>
      parseSnapshotGeneratedAt(value, new Date("2026-07-18T03:00:00.000Z")),
    ).toThrow("RFC 3339");
  });

  it("accepts the maximum future clock skew boundary", () => {
    const now = new Date("2026-07-18T03:00:00.000Z");
    expect(parseSnapshotGeneratedAt("2026-07-18T03:15:00.000Z", now)).toEqual(
      new Date("2026-07-18T03:15:00.000Z"),
    );
  });

  it("rejects far-future metadata", () => {
    expect(() =>
      parseSnapshotGeneratedAt(
        "2099-01-01T00:00:00.000Z",
        new Date("2026-07-18T03:00:00.000Z"),
      ),
    ).toThrow("must not be more than 15 minutes in the future");
  });

  it("rejects timestamps beyond the future clock skew boundary", () => {
    expect(() =>
      parseSnapshotGeneratedAt(
        "2026-07-18T03:15:00.001Z",
        new Date("2026-07-18T03:00:00.000Z"),
      ),
    ).toThrow("must not be more than 15 minutes in the future");
  });
});

describe("snapshot completeness validation", () => {
  const metadata = {
    catalog_lesson_min_semester_id: "401",
    catalog_exam_min_semester_id: "381",
    jw_schedule_chunk_size: "100",
  };

  it.each([
    "catalog_lesson_min_semester_id",
    "catalog_exam_min_semester_id",
    "jw_schedule_chunk_size",
  ])("requires explicit %s rather than assuming historical coverage", (key) => {
    const incomplete: Record<string, string> = { ...metadata };
    delete incomplete[key];
    expect(() =>
      validateSnapshotCompleteness({
        metadata: incomplete,
        semesterRows: semesterRows(401),
        catalogLessonRows: [],
        fetchRows: completeFetches(401, 0),
      }),
    ).toThrow(`snapshot metadata ${key} is required`);
  });

  it("accepts all expected JW chunks and a zero-lesson semester", () => {
    const result = validateSnapshotCompleteness({
      metadata,
      semesterRows: semesterRows(381, 401, 421),
      catalogLessonRows: [...lessonRows(401, 101), ...lessonRows(421, 0)],
      fetchRows: [...completeFetches(401, 2), ...completeFetches(421, 0)],
    });

    expect(result.sectionJwIds).toHaveLength(101);
    expect(result.sectionSemesterJwIds).toEqual([401, 421]);
    expect(result.examSemesterJwIds).toEqual([401, 421]);
  });

  it("imports historical catalog coverage and keeps exam reconciliation within fetched semesters", () => {
    const result = validateSnapshotCompleteness({
      metadata: { ...metadata, catalog_lesson_min_semester_id: "201" },
      semesterRows: semesterRows(181, 201, 202, 221, 401),
      catalogLessonRows: [
        ...lessonRows(201, 1),
        ...lessonRows(221, 1),
        ...lessonRows(401, 1),
      ],
      fetchRows: [
        fetchRow("catalog_teach_lesson_list_for_teach", 201),
        fetchRow("jw_ws_schedule_table_datum", 201, { chunkIndex: 0 }),
        fetchRow("catalog_teach_lesson_list_for_teach", 202),
        fetchRow("catalog_teach_lesson_list_for_teach", 221),
        fetchRow("jw_ws_schedule_table_datum", 221, { chunkIndex: 0 }),
        ...completeFetches(401, 1),
      ],
    });
    expect(result.catalogMinSemester).toBe(201);
    expect(result.sectionSemesterJwIds).toEqual([201, 202, 221, 401]);
    expect(result.sectionJwIds).toHaveLength(3);
    expect(result.examSemesterJwIds).toEqual([401]);
  });

  it("recognizes an explicitly fetched empty historical exam list", () => {
    const result = validateSnapshotCompleteness({
      metadata: { ...metadata, catalog_lesson_min_semester_id: "201" },
      semesterRows: semesterRows(201),
      catalogLessonRows: lessonRows(201, 1),
      fetchRows: completeFetches(201, 1),
    });
    expect(result.examSemesterJwIds).toEqual([201]);
  });

  it("requires explicit catalog coverage instead of silently applying a default", () => {
    expect(() =>
      validateSnapshotCompleteness({
        metadata: {},
        semesterRows: [],
        catalogLessonRows: [],
        fetchRows: [],
      }),
    ).toThrow("catalog_lesson_min_semester_id is required");
  });

  it("keeps explicitly unavailable exams out of reconciliation while importing their courses", () => {
    const result = validateSnapshotCompleteness({
      metadata: {
        ...metadata,
        catalog_lesson_min_semester_id: "201",
        catalog_exam_min_semester_id: "1",
        catalog_exam_unavailable_semester_ids: "201",
      },
      semesterRows: semesterRows(201, 202),
      catalogLessonRows: [...lessonRows(201, 1), ...lessonRows(202, 1)],
      fetchRows: [
        fetchRow("catalog_teach_lesson_list_for_teach", 201),
        fetchRow("jw_ws_schedule_table_datum", 201, { chunkIndex: 0 }),
        fetchRow("catalog_teach_exam_list", 201, { ok: false }),
        ...completeFetches(202, 1),
      ],
    });
    expect(result.sectionJwIds).toHaveLength(2);
    expect(result.examSemesterJwIds).toEqual([202]);
    expect(result.unavailableExamSemesterJwIds).toEqual([201]);
  });

  it.each(["missing", "success"])(
    "rejects an unavailable declaration with %s failure evidence",
    (kind) => {
      const fetches = completeFetches(401, 1).filter(
        (row) => row.source !== "catalog_teach_exam_list",
      );
      if (kind === "success")
        fetches.push(fetchRow("catalog_teach_exam_list", 401));
      expect(() =>
        validateSnapshotCompleteness({
          metadata: {
            ...metadata,
            catalog_exam_unavailable_semester_ids: "401",
          },
          semesterRows: semesterRows(401),
          catalogLessonRows: lessonRows(401, 1),
          fetchRows: fetches,
        }),
      ).toThrow("contradictory fetch records");
    },
  );

  it("never treats an unannounced failed exam request as an empty list", () => {
    expect(() =>
      validateSnapshotCompleteness({
        metadata,
        semesterRows: semesterRows(401),
        catalogLessonRows: lessonRows(401, 1),
        fetchRows: [
          ...completeFetches(401, 1).filter(
            (row) => row.source !== "catalog_teach_exam_list",
          ),
          fetchRow("catalog_teach_exam_list", 401, { ok: false }),
        ],
      }),
    ).toThrow("failed");
  });

  it("excludes explicitly unavailable curricula from every reconciliation scope", () => {
    const result = validateSnapshotCompleteness({
      metadata: {
        ...metadata,
        catalog_lesson_min_semester_id: "201",
        curriculum_unavailable_semester_ids: "201",
      },
      semesterRows: semesterRows(201, 401),
      catalogLessonRows: lessonRows(401, 1),
      fetchRows: [
        fetchRow("catalog_teach_lesson_list_for_teach", 201, { ok: false }),
        ...completeFetches(401, 1),
      ],
    });
    expect(result.sectionSemesterJwIds).toEqual([401]);
    expect(result.examSemesterJwIds).toEqual([401]);
    expect(result.unavailableCurriculumSemesterJwIds).toEqual([201]);
  });

  it.each([
    "catalog_teach_lesson_list_for_teach",
    "jw_ws_schedule_table_datum",
  ])(
    "requires failed %s evidence for unavailable curricula and rejects partial data",
    (source) => {
      const input = {
        metadata: { ...metadata, curriculum_unavailable_semester_ids: "401" },
        semesterRows: semesterRows(401),
        catalogLessonRows: [],
        fetchRows: [fetchRow(source, 401, { ok: false })],
      };
      expect(validateSnapshotCompleteness(input).sectionSemesterJwIds).toEqual(
        [],
      );
      expect(() =>
        validateSnapshotCompleteness({ ...input, fetchRows: [] }),
      ).toThrow("contradictory fetch records");
      expect(() =>
        validateSnapshotCompleteness({
          ...input,
          catalogLessonRows: lessonRows(401, 1),
        }),
      ).toThrow("partial data");
    },
  );

  it("rejects a failed JW chunk", () => {
    expect(() =>
      validateSnapshotCompleteness({
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
      }),
    ).toThrow("failed");
  });

  it("rejects a missing JW chunk", () => {
    expect(() =>
      validateSnapshotCompleteness({
        metadata,
        semesterRows: semesterRows(401),
        catalogLessonRows: lessonRows(401, 201),
        fetchRows: completeFetches(401, 2),
      }),
    ).toThrow("expected JW chunks 0,1,2");
  });

  it("rejects duplicate or extra JW chunks", () => {
    expect(() =>
      validateSnapshotCompleteness({
        metadata,
        semesterRows: semesterRows(401),
        catalogLessonRows: lessonRows(401, 1),
        fetchRows: [
          ...completeFetches(401, 1),
          fetchRow("jw_ws_schedule_table_datum", 401, { chunkIndex: 1 }),
        ],
      }),
    ).toThrow("expected JW chunks 0");
  });

  it("rejects expected-chunk metadata that contradicts catalog lessons", () => {
    expect(() =>
      validateSnapshotCompleteness({
        metadata: {
          ...metadata,
          jw_schedule_expected_chunk_count_401: "2",
        },
        semesterRows: semesterRows(401),
        catalogLessonRows: lessonRows(401, 1),
        fetchRows: completeFetches(401, 1),
      }),
    ).toThrow("expected chunk metadata");
  });

  it.each(["catalog_teach_lesson_list_for_teach", "catalog_teach_exam_list"])(
    "rejects a missing successful %s fetch",
    (missingSource) => {
      expect(() =>
        validateSnapshotCompleteness({
          metadata,
          semesterRows: semesterRows(401),
          catalogLessonRows: lessonRows(401, 1),
          fetchRows: completeFetches(401, 1).filter(
            (row) => row.source !== missingSource,
          ),
        }),
      ).toThrow(missingSource);
    },
  );

  it("ignores semesters outside the snapshot catalog coverage", () => {
    expect(() =>
      validateSnapshotCompleteness({
        metadata,
        semesterRows: semesterRows(381, 401),
        catalogLessonRows: lessonRows(401, 1),
        fetchRows: completeFetches(401, 1),
      }),
    ).not.toThrow();
  });

  it("rejects an in-scope lesson without a usable Section jwId", () => {
    expect(() =>
      validateSnapshotCompleteness({
        metadata,
        semesterRows: semesterRows(401),
        catalogLessonRows: [{ semester_id: 401 }],
        fetchRows: completeFetches(401, 1),
      }),
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
