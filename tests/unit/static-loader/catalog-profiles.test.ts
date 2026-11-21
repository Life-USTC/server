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
      jw_catalog_course_infos: [info(14, "FIRST")],
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
  expect(profiles.courseIdentityConflicts).toBe(4);
  expect(profiles.courses).toEqual([
    expect.objectContaining({
      jwId: 13,
      payloadJson: partial.payload_json,
      nameCn: "00013",
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

it("supplements missing profile fields from JW without replacing catalog values or identities", () => {
  const profiles = loadCatalogProfiles(
    snapshot({
      catalog_teach_course_infos: [
        info(10, "0010", {
          credit: 0,
          textbook: "",
          desc: { cn: "catalog", en: null },
          syllabus: { documents: "preserved" },
        }),
        info(15, "PRIMARY"),
        info(20, "CONFLICT"),
        info(21, "CONFLICT"),
      ],
      jw_catalog_course_infos: [
        info(10, "0010", {
          credit: 3,
          textbook: null,
          jw: { periods: { theory: 20 } },
          desc: { cn: "jw", en: "English" },
          ref: "Reference",
          syllabus: null,
        }),
        info(11, "0011", { name: { cn: "JW only" } }),
        info(12, "PRIMARY"), // A fallback conflict must not remove catalog course 15.
        info(20, "CONFLICT"),
      ],
      jw_catalog_lesson_infos: [
        {
          ...info(30, "0011.01", { courseId: 11 }),
          courseId: 11,
          semester_id: "461",
        },
      ],
    }),
  );
  expect(profiles.courses.map(({ jwId }) => jwId)).toEqual([10, 15, 11]);
  expect(JSON.parse(profiles.courses[0].payloadJson)).toMatchObject({
    credit: 0,
    textbook: "",
    jw: { periods: { theory: 20 } },
    desc: { cn: "catalog", en: "English" },
    ref: "Reference",
    syllabus: { documents: "preserved" },
  });
  expect(profiles.courses[2].nameCn).toBe("JW only");
  expect(profiles.sections[0]).toMatchObject({
    jwId: 30,
    courseJwId: 11,
    semesterJwId: 461,
  });
  expect(profiles.courseIdentityConflicts).toBeGreaterThan(0);
});
