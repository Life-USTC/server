import { describe, expect, it } from "vitest";
import {
  type CourseIdentityRecord,
  courseSourceIdentityKey,
  type IncomingCourseIdentityRecord,
  planCourseIdentityImport,
  stableSyntheticCourseJwId,
} from "@/static-loader/course-identity";
import {
  requireCourseDatabaseId,
  requireCourseSourceKey,
  sectionConflictUpdateColumns,
} from "@/static-loader/upsert-policy";

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

function incoming(
  jwId: number,
  overrides: Partial<CourseIdentityRecord> = {},
): IncomingCourseIdentityRecord {
  const record = course(jwId, overrides);
  return {
    ...record,
    sourceKey: courseSourceIdentityKey({
      jwId,
      code: record.code,
      nameCn: record.nameCn,
      nameEn: record.nameEn,
      categoryName:
        record.categoryId == null ? null : `category-${record.categoryId}`,
      classTypeName:
        record.classTypeId == null ? null : `class-type-${record.classTypeId}`,
      classifyName:
        record.classifyId == null ? null : `classify-${record.classifyId}`,
      educationLevelName:
        record.educationLevelId == null
          ? null
          : `education-${record.educationLevelId}`,
      gradationName:
        record.gradationId == null ? null : `gradation-${record.gradationId}`,
      typeName: record.typeId == null ? null : `type-${record.typeId}`,
    }),
  };
}

describe("static course identity planning", () => {
  it("maps multiple source IDs with identical metadata to one stable synthetic Course", async () => {
    const first = incoming(9328);
    const second = incoming(12000);
    const plan = await planCourseIdentityImport([first, second], []);

    expect(plan.canonicalCourses).toHaveLength(1);
    expect(plan.canonicalCourses[0].jwId).toBeGreaterThanOrEqual(1_500_000_000);
    expect(plan.canonicalCourses[0].jwId).toBeLessThan(1_900_000_000);
    expect(plan.canonicalJwIdBySourceKey.get(first.sourceKey)).toBe(
      plan.canonicalCourses[0].jwId,
    );
  });

  it("deduplicates repeated occurrences with the same raw ID and metadata", async () => {
    const occurrence = incoming(141548);
    const plan = await planCourseIdentityImport(
      [occurrence, { ...occurrence }],
      [],
    );

    expect(plan.canonicalCourses).toHaveLength(1);
    expect(plan.canonicalJwIdBySourceKey.size).toBe(1);
  });

  it("keeps an exact full-identity source row without guessing between historical duplicates", async () => {
    const current = incoming(9328);
    const plan = await planCourseIdentityImport(
      [current],
      [course(9328), course(1637214764)],
    );

    expect(plan.canonicalCourses).toEqual([course(9328)]);
    expect(plan.canonicalJwIdBySourceKey.get(current.sourceKey)).toBe(9328);
  });

  it("does not overwrite an occupied raw source ID with different metadata", async () => {
    const changed = incoming(9328, { categoryId: 9 });
    const plan = await planCourseIdentityImport([changed], [course(9328)]);

    expect(plan.canonicalCourses).toHaveLength(1);
    expect(plan.canonicalCourses[0]).toMatchObject({
      categoryId: 9,
    });
    expect(plan.canonicalCourses[0].jwId).not.toBe(9328);
  });

  it("reuses one stored full-identity match when the source ID changes", async () => {
    const changedSource = incoming(12000);
    const plan = await planCourseIdentityImport(
      [changedSource],
      [course(1637214764)],
    );

    expect(plan.canonicalCourses).toEqual([course(1637214764)]);
    expect(plan.canonicalJwIdBySourceKey.get(changedSource.sourceKey)).toBe(
      1637214764,
    );
  });

  it("normalizes persisted strings before matching a changed source ID", async () => {
    const changedSource = incoming(12000, { nameEn: undefined });
    const stored = course(1637214764, {
      code: " 001046 ",
      nameCn: " 数值分析 ",
      nameEn: " ",
    });
    const plan = await planCourseIdentityImport([changedSource], [stored]);
    const { sourceKey: _sourceKey, ...expectedCourse } = changedSource;

    expect(plan.canonicalCourses).toEqual([
      { ...expectedCourse, jwId: 1637214764 },
    ]);
    expect(plan.canonicalCourses[0]).not.toHaveProperty("sourceKey");
  });

  it("keeps same-code metadata variants as separate Courses", async () => {
    const original = incoming(9328);
    const variant = incoming(9209, {
      nameCn: "计算机图形学",
      nameEn: "Computer Graphics",
      categoryId: 9,
    });
    const plan = await planCourseIdentityImport([original, variant], []);

    expect(plan.canonicalCourses).toHaveLength(2);
    expect(new Set(plan.canonicalCourses.map((item) => item.jwId)).size).toBe(
      2,
    );
    expect(plan.canonicalJwIdBySourceKey.get(original.sourceKey)).not.toBe(
      plan.canonicalJwIdBySourceKey.get(variant.sourceKey),
    );
  });

  it("preserves two metadata variants that share one raw source ID", async () => {
    const original = incoming(141548);
    const variant = incoming(141548, {
      categoryId: 9,
      nameCn: "数值分析（专业学位）",
    });
    const plan = await planCourseIdentityImport([original, variant], []);

    expect(plan.canonicalCourses).toHaveLength(2);
    expect(plan.canonicalCourses.every((item) => item.jwId !== 141548)).toBe(
      true,
    );
    expect(new Set(plan.canonicalCourses.map((item) => item.jwId)).size).toBe(
      2,
    );
  });

  it("is stable across snapshot order and repeated imports", async () => {
    const original = incoming(141548);
    const variant = incoming(141548, {
      categoryId: 9,
      nameCn: "数值分析（专业学位）",
    });
    const first = await planCourseIdentityImport([original, variant], []);
    const rerun = await planCourseIdentityImport(
      [variant, original],
      first.canonicalCourses,
    );

    expect(rerun.canonicalCourses).toEqual(first.canonicalCourses);
    expect([...rerun.canonicalJwIdBySourceKey]).toEqual([
      ...first.canonicalJwIdBySourceKey,
    ]);
  });

  it("resolves each lesson parent to its exact variant key", () => {
    const original = incoming(141548);
    const variant = incoming(141548, {
      categoryId: 9,
      nameCn: "数值分析（专业学位）",
    });
    const sourceKeyByParentId = new Map([
      [1001, original.sourceKey],
      [1002, variant.sourceKey],
    ]);

    expect(requireCourseSourceKey(sourceKeyByParentId, 1001)).toBe(
      original.sourceKey,
    );
    expect(requireCourseSourceKey(sourceKeyByParentId, 1002)).toBe(
      variant.sourceKey,
    );
  });

  it("fails closed when a lesson parent has no Course identity", () => {
    expect(() => requireCourseSourceKey(new Map(), 1001)).toThrow(
      "Course identity key is missing for lesson parent 1001",
    );
  });

  it("fails closed when a Section identity has no Course mapping", () => {
    expect(() => requireCourseDatabaseId(new Map(), "missing", 1001)).toThrow(
      "Course identity map did not resolve section jwId 1001",
    );
  });

  it("never rebinds courseId while updating an existing Section", () => {
    expect(
      sectionConflictUpdateColumns(["code", "courseId", "semesterId"]),
    ).toEqual(["code", "semesterId"]);
  });

  it("reuses the matching raw row for one shared-ID variant and synthesizes the other", async () => {
    const original = incoming(141548);
    const variant = incoming(141548, {
      categoryId: 9,
      nameCn: "数值分析（专业学位）",
    });
    const plan = await planCourseIdentityImport(
      [original, variant],
      [course(141548)],
    );

    expect(plan.canonicalJwIdBySourceKey.get(original.sourceKey)).toBe(141548);
    expect(plan.canonicalJwIdBySourceKey.get(variant.sourceKey)).not.toBe(
      141548,
    );
  });

  it("leaves an unrelated row occupying the raw ID untouched", async () => {
    const variant = incoming(141548, {
      categoryId: 9,
      nameCn: "数值分析（专业学位）",
    });
    const plan = await planCourseIdentityImport(
      [variant],
      [course(141548, { nameCn: "另一门课程" })],
    );

    expect(plan.canonicalCourses[0].jwId).not.toBe(141548);
    expect(plan.canonicalCourses[0].nameCn).toBe("数值分析（专业学位）");
  });

  it("reuses both a matching raw row and an old synthetic variant", async () => {
    const original = incoming(141548);
    const variant = incoming(141548, {
      categoryId: 9,
      nameCn: "数值分析（专业学位）",
    });
    const oldVariant = course(1650000000, {
      categoryId: 9,
      nameCn: "数值分析（专业学位）",
    });
    const plan = await planCourseIdentityImport(
      [original, variant],
      [course(141548), oldVariant],
    );

    expect(plan.canonicalJwIdBySourceKey.get(original.sourceKey)).toBe(141548);
    expect(plan.canonicalJwIdBySourceKey.get(variant.sourceKey)).toBe(
      1650000000,
    );
  });

  it("aborts instead of choosing between ambiguous stored identity matches", async () => {
    await expect(
      planCourseIdentityImport(
        [incoming(12000)],
        [course(9328), course(1637214764)],
      ),
    ).rejects.toThrow(
      'Ambiguous stored course identity for code "001046": 2 matching Course rows exist',
    );
  });

  it("aborts when multiple exact source IDs already point at separate rows", async () => {
    await expect(
      planCourseIdentityImport(
        [incoming(9328), incoming(12000)],
        [course(9328), course(12000)],
      ),
    ).rejects.toThrow(
      'Ambiguous course identity for code "001046": source jwIds 9328, 12000 already exist as separate Course rows',
    );
  });

  it("rejects one semantic source key that maps to conflicting persisted metadata", async () => {
    const original = incoming(9328);
    const conflict = {
      ...incoming(9328, { categoryId: 9 }),
      sourceKey: original.sourceKey,
    };

    await expect(
      planCourseIdentityImport([original, conflict], []),
    ).rejects.toThrow("maps to conflicting metadata in the same snapshot");
  });

  it("rejects a synthetic jwId occupied by another persisted identity", async () => {
    const source = incoming(9328);
    await expect(
      planCourseIdentityImport(
        [source],
        [course(1700000000, { nameCn: "另一门课程" })],
        async () => 1700000000,
      ),
    ).rejects.toThrow(
      'Synthetic course jwId collision for code "001046": 1700000000',
    );
  });

  it("rejects synthetic collisions between planned variants", async () => {
    await expect(
      planCourseIdentityImport(
        [incoming(9328), incoming(9209, { categoryId: 9 })],
        [],
        async () => 1700000000,
      ),
    ).rejects.toThrow(
      "Course jwId 1700000000 was assigned to multiple identities",
    );
  });

  it("builds a normalized source key independent of raw and database IDs", () => {
    const first = courseSourceIdentityKey({
      jwId: 1,
      code: " 001046 ",
      nameCn: " 数值分析 ",
      nameEn: " ",
      categoryName: " 专业基础课 ",
    });
    const second = courseSourceIdentityKey({
      jwId: 999,
      code: "001046",
      nameCn: "数值分析",
      categoryName: "专业基础课",
    });

    expect(first).toBe(second);
  });

  it("generates a stable synthetic ID for a known semantic identity", async () => {
    const sourceKey = incoming(9328).sourceKey;

    await expect(stableSyntheticCourseJwId(sourceKey)).resolves.toBe(
      1811372887,
    );
  });

  it("requires a course code before planning writes", async () => {
    const invalid = incoming(9328);
    invalid.code = "  ";
    await expect(planCourseIdentityImport([invalid], [])).rejects.toThrow(
      "Course code for source jwId 9328 is missing",
    );
  });
});
