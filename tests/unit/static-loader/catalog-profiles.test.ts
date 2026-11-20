import { describe, expect, it } from "vitest";
import {
  loadCatalogProfiles,
  mergeOfficialCourses,
  officialCourseLookups,
} from "../../../src/static-loader/catalog-profiles";
import type { SnapshotRow } from "../../../src/static-loader/snapshot-values";

const COURSE_INFO = "catalog_teach_course_infos";
const SECTION_INFO = "catalog_teach_lesson_infos";

function snapshot(tables: Record<string, SnapshotRow[]>) {
  return {
    hasTable: (table: string) => table in tables,
    *iterateAll(table: string) {
      yield* tables[table] ?? [];
    },
  };
}

function info(id: number, code: string, payload: SnapshotRow = {}) {
  return { id, code, payload_json: JSON.stringify({ id, code, ...payload }) };
}

describe("official catalog profile ingestion", () => {
  it("preserves raw provenance while creating only nonconflicting official-only courses", () => {
    const richFields = {
      name: { cn: "官方课程", en: "Official course" },
      desc: { cn: "<p>简介 &amp; 教材</p>", en: null },
      syllabus: { documents: '{"language-zh":{"paragraphs":[]}}' },
      textbooks: [{ isbn: "001234" }],
      courseCategory: "本科计划内课程",
      courseClassify: "艺术与审美",
      courseType: "理论课",
    };
    const current = info(142000, "CS4017e", richFields);
    const officialOnly = info(142001, "001234", richFields);
    const profiles = loadCatalogProfiles(
      snapshot({
        [COURSE_INFO]: [current, officialOnly, info(142002, "CS4017")],
      }),
    );

    const archive = [{ jwId: 142000, code: "CS4017", nameCn: "旧代码历史" }];
    const courses = mergeOfficialCourses(archive, profiles);
    expect(courses).toEqual([
      archive[0],
      {
        jwId: 142001,
        code: "001234",
        nameCn: "官方课程",
        nameEn: "Official course",
        categoryName: "本科计划内课程",
        classifyName: "艺术与审美",
        typeName: "理论课",
      },
    ]);
    expect(profiles.courses[0].payloadJson).toBe(current.payload_json);

    const categories = [{ nameCn: "本科计划内课程", nameEn: "Undergraduate" }];
    const lookups = officialCourseLookups(
      {
        courseCategories: categories,
        courseClassifies: [],
        courseTypes: [],
        courseGradations: [],
        educationLevels: [],
        classTypes: [],
        examModes: [],
        teachLanguages: [],
      },
      courses,
    );
    expect(lookups.courseCategories).toEqual(categories);
    expect(lookups.courseClassifies).toEqual([{ nameCn: "艺术与审美" }]);
    expect(lookups.courseTypes).toEqual([{ nameCn: "理论课" }]);
  });

  it("quarantines conflicting IDs and keeps section codes scoped to the semester", () => {
    const profiles = loadCatalogProfiles(
      snapshot({
        [COURSE_INFO]: [
          info(10, "DUP"),
          info(11, "DUP"),
          info(12, "FIRST"),
          info(12, "SECOND"),
          info(15, "THIRD", { id: 16 }),
        ],
        [SECTION_INFO]: [
          {
            ...info(21, "REAL.01", { courseId: 51 }),
            semester_id: "461",
            courseId: 51,
          },
          {
            ...info(22, "REAL.01", { courseId: 51 }),
            semester_id: "421",
            courseId: 51,
          },
          {
            ...info(23, "BAD.01", { courseId: 52 }),
            semester_id: "461",
            courseId: 51,
          },
        ],
      }),
    );
    expect(profiles.courseIdentityConflicts).toBe(4);
    expect(profiles.courses).toEqual([]);
    expect(profiles.sectionIdentityConflicts).toBe(1);
    expect(
      profiles.sections.map((profile) => [
        profile.jwId,
        profile.semesterJwId,
        profile.courseJwId,
      ]),
    ).toEqual([
      [21, 461, 51],
      [22, 421, 51],
    ]);
  });

  it("treats missing profile tables as an old snapshot", () => {
    expect(loadCatalogProfiles(snapshot({}))).toEqual({
      courses: [],
      sections: [],
      courseIdentityConflicts: 0,
      sectionIdentityConflicts: 0,
    });
  });

  it("retains partial documents with nullable descriptive fields", () => {
    const course = info(31, "000031", { name: null, courseCategory: null });
    const section = {
      ...info(32, "000031.01", { courseId: 31, desc: null, grading: null }),
      semester_id: "461",
      courseId: 31,
    };
    const profiles = loadCatalogProfiles(
      snapshot({ [COURSE_INFO]: [course], [SECTION_INFO]: [section] }),
    );

    expect(profiles.courses[0]).toMatchObject({
      payloadJson: course.payload_json,
      course: { jwId: 31, code: "000031", nameCn: "000031" },
    });
    expect(profiles.sections[0]).toMatchObject({
      payloadJson: section.payload_json,
      courseJwId: 31,
      semesterJwId: 461,
    });
  });
});
