import { describe, expect, it } from "vitest";
import {
  assertStaticTeacherReferencesResolvable,
  buildStaticCourseIdentityKeyBySourceId,
  buildStaticCourseImportRows,
  staticCourseMetadataSignature,
  staticDepartmentCode,
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
          id: 1,
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

  it("keeps duplicate course codes together when metadata matches", () => {
    const identityKeys = buildStaticCourseIdentityKeyBySourceId([
      {
        id: 1,
        course_code: "MARX6102U",
        name: "思想政治理论课实践",
        course_type: "实践课",
        course_gradation: "本科",
        course_category: "公共基础课",
        education_type: "本科生",
        class_type: "实践",
      },
      {
        id: 2,
        course_code: "MARX6102U",
        name: "思想政治理论课实践",
        course_type: "实践课",
        course_gradation: "本科",
        course_category: "公共基础课",
        education_type: "本科生",
        class_type: "实践",
      },
    ]);

    expect(identityKeys.get(1)).toBe("MARX6102U");
    expect(identityKeys.get(2)).toBe("MARX6102U");
  });

  it("splits duplicate course codes when metadata differs", () => {
    const courses = [
      {
        id: 1,
        course_code: "HS2002",
        name: "科学技术史",
        course_type: "通识课",
        course_gradation: "本科",
        course_category: "通识教育",
        education_type: "本科生",
        class_type: "理论",
      },
      {
        id: 2,
        course_code: "HS2002",
        name: "科学技术史",
        course_type: "通识课",
        course_gradation: "本科",
        course_category: "人文素质",
        education_type: "本科生",
        class_type: "理论",
      },
    ];
    const identityKeys = buildStaticCourseIdentityKeyBySourceId(courses);
    const rows = buildStaticCourseImportRows(
      courses,
      {
        courseTypeIdByName: new Map([["通识课", 21]]),
        courseGradationIdByName: new Map([["本科", 22]]),
        courseCategoryIdByName: new Map([
          ["通识教育", 23],
          ["人文素质", 24],
        ]),
        educationLevelIdByName: new Map([["本科生", 25]]),
        classTypeIdByName: new Map([["理论", 26]]),
      },
      (course) => (course.id === 1 ? 1_500_000_101 : 1_500_000_102),
    );

    expect(identityKeys.get(1)).toBe("HS2002");
    expect(identityKeys.get(1)).not.toBe(identityKeys.get(2));
    expect(rows.map((row) => row.jwId)).toEqual([1_500_000_101, 1_500_000_102]);
    expect(rows.map((row) => row.categoryId)).toEqual([23, 24]);
  });

  it("preserves the stored canonical course metadata for duplicate codes", () => {
    const newVariant = {
      id: 1,
      course_code: "HS2002",
      name: "科学技术史",
      course_type: "通识课",
      course_gradation: "本科",
      course_category: "人文素质",
      education_type: "本科生",
      class_type: "理论",
    };
    const storedCanonicalVariant = {
      id: 2,
      course_code: "HS2002",
      name: "科学技术史",
      course_type: "通识课",
      course_gradation: "本科",
      course_category: "通识教育",
      education_type: "本科生",
      class_type: "理论",
    };

    const identityKeys = buildStaticCourseIdentityKeyBySourceId(
      [newVariant, storedCanonicalVariant],
      {
        canonicalSignatureByCode: new Map([
          ["HS2002", staticCourseMetadataSignature(storedCanonicalVariant)],
        ]),
      },
    );

    expect(identityKeys.get(storedCanonicalVariant.id)).toBe("HS2002");
    expect(identityKeys.get(newVariant.id)).not.toBe("HS2002");
  });

  it("derives static department identity from the name instead of looking up by name", () => {
    expect(staticDepartmentCode("网络空间安全学院")).toMatch(
      /^static-[0-9a-f]{12}$/,
    );
    expect(staticDepartmentCode(" 网络空间安全学院 ")).toBe(
      staticDepartmentCode("网络空间安全学院"),
    );
  });
});
