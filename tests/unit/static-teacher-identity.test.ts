import { describe, expect, it } from "vitest";
import {
  planTeacherImport,
  sectionTeacherNameKey,
  type TeacherOccurrence,
} from "@/static-loader/teacher-identity";

function occurrence(
  sectionJwId: number,
  semesterCode: number,
  teacher: TeacherOccurrence["teacher"],
): TeacherOccurrence {
  return { sectionJwId, semesterCode, teacher };
}

describe("static teacher identity planning", () => {
  it("correlates one Catalog and JW teacher within the same Section", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          personId: 10,
          teacherId: 20,
          code: "T001",
          nameCn: "张三",
          teacherTitleId: 30,
        }),
      ],
      [
        occurrence(100, 401, {
          nameCn: "张三",
          nameEn: "Zhang San",
          departmentCode: "006",
        }),
      ],
    );

    expect(plan.teachers).toEqual([
      {
        personId: 10,
        teacherId: 20,
        code: "T001",
        nameCn: "张三",
        nameEn: "Zhang San",
        departmentCode: "006",
        teacherTitleId: 30,
      },
    ]);
    expect(
      plan.sectionTeacherIdentities.get(sectionTeacherNameKey(100, "张三")),
    ).toEqual({
      personId: 10,
      teacherId: 20,
      code: "T001",
    });
    expect(plan.catalogFallbackResolutions).toEqual([
      {
        fallback: { nameCn: "张三", departmentCode: "006" },
        targetIdentity: {
          personId: 10,
          teacherId: 20,
          code: "T001",
        },
      },
    ]);
  });

  it("keeps single-source teachers", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          personId: 10,
          nameCn: "仅 JW",
        }),
      ],
      [
        occurrence(200, 401, {
          nameCn: "仅 Catalog",
          departmentCode: "006",
        }),
      ],
    );

    expect(plan.teachers).toHaveLength(2);
    expect(plan.teachers).toContainEqual({
      personId: 10,
      nameCn: "仅 JW",
    });
    expect(plan.teachers).toContainEqual({
      nameCn: "仅 Catalog",
      departmentCode: "006",
    });
    expect(plan.catalogFallbackResolutions).toEqual([]);
  });

  it("keeps an ambiguous same-Section name separate", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          personId: 10,
          nameCn: "李同名",
        }),
        occurrence(100, 401, {
          personId: 11,
          nameCn: "李同名",
        }),
      ],
      [
        occurrence(100, 401, {
          nameCn: "李同名",
          departmentCode: "006",
        }),
      ],
    );

    expect(plan.teachers).toHaveLength(3);
    expect(
      plan.sectionTeacherIdentities.has(sectionTeacherNameKey(100, "李同名")),
    ).toBe(false);
  });

  it("does not merge different stable identities with the same global name and department", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          personId: 10,
          nameCn: "王同名",
        }),
        occurrence(200, 401, {
          personId: 11,
          nameCn: "王同名",
        }),
      ],
      [
        occurrence(100, 401, {
          nameCn: "王同名",
          departmentCode: "006",
        }),
        occurrence(200, 401, {
          nameCn: "王同名",
          departmentCode: "006",
        }),
      ],
    );

    expect(plan.teachers).toEqual([
      {
        personId: 10,
        nameCn: "王同名",
        departmentCode: "006",
      },
      {
        personId: 11,
        nameCn: "王同名",
        departmentCode: "006",
      },
    ]);
    expect(plan.catalogFallbackResolutions).toEqual([
      {
        fallback: { nameCn: "王同名", departmentCode: "006" },
        targetIdentity: null,
      },
    ]);
  });

  it("keeps a fallback when any Catalog occurrence remains unmatched", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          personId: 10,
          nameCn: "部分匹配",
        }),
      ],
      [
        occurrence(100, 401, {
          nameCn: "部分匹配",
          departmentCode: "006",
        }),
        occurrence(200, 401, {
          nameCn: "部分匹配",
          departmentCode: "006",
        }),
      ],
    );

    expect(plan.teachers).toContainEqual({
      nameCn: "部分匹配",
      departmentCode: "006",
    });
    expect(plan.catalogFallbackResolutions).toEqual([]);
  });

  it("uses the final canonical stable identity as the fallback target", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          personId: 10,
          teacherId: 20,
          code: "OLD",
          nameCn: "跨学期",
        }),
        occurrence(200, 421, {
          personId: 10,
          teacherId: 21,
          code: "NEW",
          nameCn: "跨学期",
        }),
      ],
      [
        occurrence(100, 401, {
          nameCn: "跨学期",
          departmentCode: "006",
        }),
        occurrence(200, 421, {
          nameCn: "跨学期",
          departmentCode: "006",
        }),
      ],
    );

    expect(plan.catalogFallbackResolutions).toEqual([
      {
        fallback: { nameCn: "跨学期", departmentCode: "006" },
        targetIdentity: {
          personId: 10,
          teacherId: 21,
          code: "NEW",
        },
      },
    ]);
  });

  it("does not retire a fallback for a schedule teacher without a stable identity", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          nameCn: "无稳定身份",
          departmentCode: "006",
        }),
      ],
      [
        occurrence(100, 401, {
          nameCn: "无稳定身份",
          departmentCode: "006",
        }),
      ],
    );

    expect(plan.teachers).toEqual([
      {
        nameCn: "无稳定身份",
        departmentCode: "006",
      },
    ]);
    expect(plan.catalogFallbackResolutions).toEqual([]);
  });

  it("uses the latest semester's non-empty metadata with older fallback", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, {
          personId: 10,
          teacherId: 20,
          code: "OLD",
          nameCn: "张三",
          teacherTitleId: 30,
        }),
        occurrence(200, 421, {
          personId: 10,
          teacherId: 21,
          code: "NEW",
          nameCn: "张三",
        }),
      ],
      [],
    );

    expect(plan.teachers).toEqual([
      {
        personId: 10,
        teacherId: 21,
        code: "NEW",
        nameCn: "张三",
        teacherTitleId: 30,
      },
    ]);
  });

  it("merges complementary metadata within the same semester", () => {
    const first = occurrence(100, 421, {
      personId: 10,
      teacherId: 20,
      code: "T001",
      nameCn: "张三",
      email: "zhangsan@example.com",
    });
    const second = occurrence(200, 421, {
      personId: 10,
      teacherId: 20,
      code: "T001",
      nameCn: "张三",
      teacherTitleId: 30,
    });

    expect(planTeacherImport([first, second], []).teachers).toEqual([
      {
        personId: 10,
        teacherId: 20,
        code: "T001",
        nameCn: "张三",
        email: "zhangsan@example.com",
        teacherTitleId: 30,
      },
    ]);
  });

  it("uses the most frequent same-semester value", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 421, {
          personId: 10,
          teacherId: 21,
          code: "NEW",
          nameCn: "张三",
        }),
        occurrence(200, 421, {
          personId: 10,
          teacherId: 20,
          code: "OLD",
          nameCn: "张三",
        }),
        occurrence(300, 421, {
          personId: 10,
          teacherId: 21,
          code: "NEW",
          nameCn: "张三",
        }),
      ],
      [],
    );

    expect(plan.teachers[0]).toMatchObject({
      teacherId: 21,
      code: "NEW",
    });
  });

  it("uses stable ascending values to break same-semester ties", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 421, {
          personId: 10,
          teacherId: 21,
          code: "B",
          nameCn: "张三",
        }),
        occurrence(200, 421, {
          personId: 10,
          teacherId: 20,
          code: "A",
          nameCn: "张三",
        }),
      ],
      [],
    );

    expect(plan.teachers[0]).toMatchObject({
      teacherId: 20,
      code: "A",
    });
  });

  it("keeps teacherId and code from one real identity tuple", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 421, {
          personId: 196651,
          teacherId: 7637,
          code: "T2528",
          nameCn: "王皓",
        }),
        occurrence(200, 421, {
          personId: 196651,
          teacherId: 11298,
          code: "11255",
          nameCn: "王皓",
        }),
      ],
      [],
    );

    expect(plan.teachers[0]).toMatchObject({
      personId: 196651,
      teacherId: 7637,
      code: "T2528",
    });
  });

  it("is independent of input order within the same semester", () => {
    const first = occurrence(100, 421, {
      personId: 10,
      teacherId: 21,
      code: "B",
      nameCn: "张三",
    });
    const second = occurrence(200, 421, {
      personId: 10,
      teacherId: 20,
      code: "A",
      nameCn: "张三",
    });

    expect(planTeacherImport([first, second], []).teachers).toEqual(
      planTeacherImport([second, first], []).teachers,
    );
  });
});
