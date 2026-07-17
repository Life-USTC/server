import { describe, expect, it } from "vitest";
import {
  planTeacherImport,
  sectionTeacherNameKey,
  type TeacherOccurrence,
} from "@/static-loader/teacher-identity";

function occurrence(
  sectionJwId: number,
  semesterCode: number,
  sourceOrder: number,
  teacher: TeacherOccurrence["teacher"],
): TeacherOccurrence {
  return { sectionJwId, semesterCode, sourceOrder, teacher };
}

describe("static teacher identity planning", () => {
  it("correlates one Catalog and JW teacher within the same Section", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, 1, {
          personId: 10,
          teacherId: 20,
          code: "T001",
          nameCn: "张三",
          teacherTitleId: 30,
        }),
      ],
      [
        occurrence(100, 401, 2, {
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
  });

  it("keeps single-source teachers", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, 1, {
          personId: 10,
          nameCn: "仅 JW",
        }),
      ],
      [
        occurrence(200, 401, 2, {
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
  });

  it("keeps an ambiguous same-Section name separate", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, 1, {
          personId: 10,
          nameCn: "李同名",
        }),
        occurrence(100, 401, 2, {
          personId: 11,
          nameCn: "李同名",
        }),
      ],
      [
        occurrence(100, 401, 3, {
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
        occurrence(100, 401, 1, {
          personId: 10,
          nameCn: "王同名",
        }),
        occurrence(200, 401, 2, {
          personId: 11,
          nameCn: "王同名",
        }),
      ],
      [
        occurrence(100, 401, 3, {
          nameCn: "王同名",
          departmentCode: "006",
        }),
        occurrence(200, 401, 4, {
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
  });

  it("uses the latest semester's non-empty metadata with older fallback", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 401, 1, {
          personId: 10,
          teacherId: 20,
          code: "OLD",
          nameCn: "张三",
          teacherTitleId: 30,
        }),
        occurrence(200, 421, 2, {
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

  it("uses explicit source order to resolve same-semester metadata deterministically", () => {
    const earlier = occurrence(100, 421, 10, {
      personId: 10,
      teacherId: 20,
      code: "OLD",
      nameCn: "张三",
    });
    const later = occurrence(200, 421, 20, {
      personId: 10,
      teacherId: 21,
      code: "NEW",
      nameCn: "张三",
    });

    expect(planTeacherImport([later, earlier], []).teachers).toEqual(
      planTeacherImport([earlier, later], []).teachers,
    );
    expect(planTeacherImport([later, earlier], []).teachers[0]).toMatchObject({
      teacherId: 21,
      code: "NEW",
    });
  });

  it("fails closed on conflicting rows with an identical semester and source order", () => {
    expect(() =>
      planTeacherImport(
        [
          occurrence(100, 421, 10, {
            personId: 10,
            teacherId: 20,
            nameCn: "张三",
          }),
          occurrence(200, 421, 10, {
            personId: 10,
            teacherId: 21,
            nameCn: "张三",
          }),
        ],
        [],
      ),
    ).toThrow("Conflicting teacher metadata");
  });
});
