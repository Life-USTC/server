import { describe, expect, it } from "vitest";
import {
  type CourseIdentityRecord,
  planCourseIdentityImport,
} from "@/static-loader/course-identity";

function course(
  jwId: number,
  overrides: Partial<CourseIdentityRecord> = {},
): CourseIdentityRecord {
  return {
    jwId,
    code: "001046",
    nameCn: "数值分析",
    nameEn: "Numerical Analysis",
    categoryId: 1,
    classTypeId: 2,
    classifyId: null,
    educationLevelId: 3,
    gradationId: 4,
    typeId: 5,
    ...overrides,
  };
}

describe("static course identity planning", () => {
  it("maps multiple source IDs with identical metadata to one new Course", () => {
    const plan = planCourseIdentityImport([course(9328), course(12000)], []);

    expect(plan.canonicalCourses).toEqual([course(9328)]);
    expect([...plan.canonicalJwIdBySourceJwId]).toEqual([
      [9328, 9328],
      [12000, 9328],
    ]);
  });

  it("keeps an exact current source row without guessing between historical duplicates", () => {
    const plan = planCourseIdentityImport(
      [course(9328)],
      [course(9328), course(1637214764)],
    );

    expect(plan.canonicalCourses).toEqual([course(9328)]);
    expect(plan.canonicalJwIdBySourceJwId.get(9328)).toBe(9328);
  });

  it("updates metadata on the exact current source row", () => {
    const updated = course(9328, { categoryId: 9 });
    const plan = planCourseIdentityImport([updated], [course(9328)]);

    expect(plan.canonicalCourses).toEqual([updated]);
    expect(plan.canonicalJwIdBySourceJwId.get(9328)).toBe(9328);
  });

  it("reuses one stored full-identity match when the source ID changes", () => {
    const plan = planCourseIdentityImport(
      [course(12000)],
      [course(1637214764)],
    );

    expect(plan.canonicalCourses).toEqual([course(1637214764)]);
    expect(plan.canonicalJwIdBySourceJwId.get(12000)).toBe(1637214764);
  });

  it("normalizes persisted strings before matching a changed source ID", () => {
    const incoming = course(12000, { nameEn: undefined });
    const stored = course(1637214764, {
      code: " 001046 ",
      nameCn: " 数值分析 ",
      nameEn: " ",
    });
    const plan = planCourseIdentityImport([incoming], [stored]);

    expect(plan.canonicalCourses).toEqual([{ ...incoming, jwId: 1637214764 }]);
    expect(plan.canonicalJwIdBySourceJwId.get(12000)).toBe(1637214764);
  });

  it("keeps same-code metadata variants as separate Courses", () => {
    const variant = course(9209, {
      nameCn: "计算机图形学",
      nameEn: "Computer Graphics",
      categoryId: 9,
    });
    const plan = planCourseIdentityImport([course(9328), variant], []);

    expect(plan.canonicalCourses).toEqual([course(9328), variant]);
    expect(plan.canonicalJwIdBySourceJwId.get(9328)).toBe(9328);
    expect(plan.canonicalJwIdBySourceJwId.get(9209)).toBe(9209);
  });

  it("aborts instead of choosing between ambiguous stored identity matches", () => {
    expect(() =>
      planCourseIdentityImport(
        [course(12000)],
        [course(9328), course(1637214764)],
      ),
    ).toThrow(
      'Ambiguous stored course identity for code "001046": 2 matching Course rows exist',
    );
  });

  it("aborts when multiple current source IDs already point at separate rows", () => {
    expect(() =>
      planCourseIdentityImport(
        [course(9328), course(12000)],
        [course(9328), course(12000)],
      ),
    ).toThrow(
      'Ambiguous course identity for code "001046": source jwIds 9328, 12000 already exist as separate Course rows',
    );
  });

  it("rejects conflicting metadata for the same source ID", () => {
    expect(() =>
      planCourseIdentityImport(
        [course(9328), course(9328, { categoryId: 9 })],
        [],
      ),
    ).toThrow(
      "Conflicting course metadata for source jwId 9328 in the same snapshot",
    );
  });

  it("rejects a source ID collision with a different stored course code", () => {
    expect(() =>
      planCourseIdentityImport(
        [course(9328)],
        [course(9328, { code: "OTHER" })],
      ),
    ).toThrow(
      'Course source jwId collision for 9328: stored code "OTHER" does not match incoming code "001046"',
    );
  });

  it("requires a course code before planning writes", () => {
    expect(() =>
      planCourseIdentityImport([course(9328, { code: "  " })], []),
    ).toThrow("Course code for source jwId 9328 is missing");
  });
});
