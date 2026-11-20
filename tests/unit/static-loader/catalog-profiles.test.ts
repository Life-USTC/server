import { expect, it } from "vitest";
import { loadCatalogProfiles } from "../../../src/static-loader/catalog-profiles";
import type { SnapshotRow } from "../../../src/static-loader/snapshot-values";

function info(id: number, code: string, fields = {}) {
  return { id, code, payload_json: JSON.stringify({ id, code, ...fields }) };
}

function snapshot(tables: Record<string, SnapshotRow[]>) {
  return {
    hasTable: (table: string) => table in tables,
    *iterateAll(table: string) {
      yield* tables[table];
    },
  };
}

it("quarantines competing identities while preserving nullable source fields and term-scoped codes", () => {
  const partial = info(13, "00013", { name: null });
  const profiles = loadCatalogProfiles(
    snapshot({
      catalog_teach_course_infos: [
        info(10, "DUP"),
        info(11, "DUP"),
        info(12, "FIRST"),
        info(12, "SECOND"),
        partial,
      ],
      catalog_teach_lesson_infos: [
        {
          ...info(21, "REAL.01", { courseId: 13 }),
          semester_id: "461",
          courseId: 13,
        },
        {
          ...info(22, "REAL.01", { courseId: 13 }),
          semester_id: "421",
          courseId: 13,
        },
        {
          ...info(23, "BAD.01", { courseId: 12 }),
          semester_id: "461",
          courseId: 13,
        },
      ],
    }),
  );
  expect(profiles.courseIdentityConflicts).toBe(3);
  expect(profiles.courses).toEqual([
    expect.objectContaining({
      jwId: 13,
      payloadJson: partial.payload_json,
      course: expect.objectContaining({ nameCn: "00013" }),
    }),
  ]);
  expect(profiles.sectionIdentityConflicts).toBe(1);
  expect(
    profiles.sections.map(({ jwId, semesterJwId }) => [jwId, semesterJwId]),
  ).toEqual([
    [21, 461],
    [22, 421],
  ]);
});
