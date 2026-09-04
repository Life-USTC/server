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

describe("static teacher upstream identity", () => {
  it("keeps different teacherIds as distinct Teachers even for one personId", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 421, {
          jwId: 7637,
          personId: 196651,
          code: "T2528",
          nameCn: "王皓",
        }),
        occurrence(200, 421, {
          jwId: 11298,
          personId: 196651,
          code: "11255",
          nameCn: "王皓",
        }),
      ],
      [],
    );

    expect(plan.teachers.map((teacher) => teacher.jwId)).toEqual([7637, 11298]);
  });

  it("enriches a unique same-section teacher from Catalog metadata", () => {
    const plan = planTeacherImport(
      [occurrence(100, 421, { jwId: 20, nameCn: "张三" })],
      [
        {
          sectionJwId: 100,
          semesterCode: 421,
          teacher: {
            nameCn: "张三",
            nameEn: "Zhang San",
            departmentCode: "006",
          },
        },
      ],
    );

    expect(plan.teachers).toEqual([
      {
        jwId: 20,
        nameCn: "张三",
        nameEn: "Zhang San",
        departmentCode: "006",
      },
    ]);
    expect(
      plan.catalogTeacherJwIdBySectionName.get(
        sectionTeacherNameKey(100, "张三"),
      ),
    ).toBe(20);
  });

  it("does not create or enrich a Teacher for ambiguous Catalog names", () => {
    const plan = planTeacherImport(
      [
        occurrence(100, 421, { jwId: 20, nameCn: "同名" }),
        occurrence(100, 421, { jwId: 21, nameCn: "同名" }),
      ],
      [
        {
          sectionJwId: 100,
          semesterCode: 421,
          teacher: { nameCn: "同名", departmentCode: "006" },
        },
        {
          sectionJwId: 200,
          semesterCode: 421,
          teacher: { nameCn: "仅 Catalog", departmentCode: "006" },
        },
      ],
    );

    expect(plan.teachers).toHaveLength(2);
    expect(
      plan.teachers.every((teacher) => teacher.departmentCode == null),
    ).toBe(true);
    expect(plan.catalogTeacherJwIdBySectionName.size).toBe(0);
  });

  it("selects latest metadata independent of occurrence order", () => {
    const occurrences = [
      occurrence(100, 401, { jwId: 20, code: "OLD", nameCn: "旧名" }),
      occurrence(200, 421, { jwId: 20, code: "NEW", nameCn: "新名" }),
    ];
    expect(planTeacherImport(occurrences, []).teachers).toEqual([
      { jwId: 20, code: "NEW", nameCn: "新名" },
    ]);
    expect(planTeacherImport([...occurrences].reverse(), []).teachers).toEqual(
      planTeacherImport(occurrences, []).teachers,
    );
  });
});
