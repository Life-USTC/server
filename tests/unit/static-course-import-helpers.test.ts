import { describe, expect, it } from "vitest";
import {
  assertStaticTeacherReferencesResolvable,
  buildStaticCourseImportRows,
  staticTeacherIdentityKey,
  uniqueStaticTeacherReferences,
} from "../../tools/load/static-course-import-helpers";

describe("static course import helpers", () => {
  it("keeps same-name teacher references distinct by department context", () => {
    const references = uniqueStaticTeacherReferences([
      { nameCn: "张伟", departmentName: "数学科学学院", source: "course:1" },
      { nameCn: "张伟", departmentName: "物理学院", source: "course:2" },
    ]);

    expect(references).toHaveLength(2);
    expect(new Set(references.map(staticTeacherIdentityKey)).size).toBe(2);
  });

  it("reports same-name teacher ambiguity when department context is missing", () => {
    expect(() =>
      assertStaticTeacherReferencesResolvable([
        { nameCn: "张伟", departmentName: "数学科学学院", source: "course:1" },
        { nameCn: "张伟", departmentName: null, source: "lecture:2:0" },
      ]),
    ).toThrow(/Ambiguous static teacher identity for "张伟"/);
  });

  it("reports repeated same-name teachers when all department context is missing", () => {
    expect(() =>
      assertStaticTeacherReferencesResolvable([
        { nameCn: "张伟", departmentName: null, source: "course:1" },
        { nameCn: "张伟", departmentName: null, source: "course:2" },
      ]),
    ).toThrow(/references without department context/);
  });

  it("does not invent course classification metadata without a static source", () => {
    const [row] = buildStaticCourseImportRows(
      [
        {
          course_code: "MATH1001",
          name: "数学分析",
          course_type: "专业基础课",
          course_gradation: "本科",
          course_category: "专业课",
          education_type: "本科生",
          class_type: "理论",
        },
      ],
      {
        courseTypeIdByName: new Map([["专业基础课", 11]]),
        courseGradationIdByName: new Map([["本科", 12]]),
        courseCategoryIdByName: new Map([["专业课", 13]]),
        educationLevelIdByName: new Map([["本科生", 14]]),
        classTypeIdByName: new Map([["理论", 15]]),
      },
      () => 1_500_000_001,
    );

    expect(row).toEqual({
      jwId: 1_500_000_001,
      code: "MATH1001",
      nameCn: "数学分析",
      typeId: 11,
      gradationId: 12,
      categoryId: 13,
      educationLevelId: 14,
      classTypeId: 15,
      classifyId: null,
    });
  });
});
