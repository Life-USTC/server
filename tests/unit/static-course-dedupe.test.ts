import { describe, expect, it } from "vitest";
import {
  type PersistedCourseIdentityRecord,
  planCourseDuplicateMerges,
} from "@/static-loader/course-dedupe";

function course(
  id: number,
  jwId: number,
  overrides: Partial<PersistedCourseIdentityRecord> = {},
): PersistedCourseIdentityRecord {
  return {
    id,
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

describe("static course duplicate cleanup planning", () => {
  it("merges a stale row missing English metadata into the current source row", () => {
    expect(
      planCourseDuplicateMerges({
        canonicalJwIds: new Set([9328]),
        incomingSourceJwIds: new Set([9328]),
        persistedCourses: [
          course(10, 9328),
          course(20, 1637214764, { nameEn: null }),
        ],
      }),
    ).toEqual([
      {
        sourceCourseId: 20,
        sourceJwId: 1637214764,
        targetCourseId: 10,
        targetJwId: 9328,
      },
    ]);
  });

  it("keeps every Course identity still present in the current snapshot", () => {
    expect(
      planCourseDuplicateMerges({
        canonicalJwIds: new Set([9328]),
        incomingSourceJwIds: new Set([9328, 1637214764]),
        persistedCourses: [
          course(10, 9328),
          course(20, 1637214764, { nameEn: null }),
        ],
      }),
    ).toEqual([]);
  });

  it("does not discard richer metadata from a stale row", () => {
    expect(
      planCourseDuplicateMerges({
        canonicalJwIds: new Set([9328]),
        incomingSourceJwIds: new Set([9328]),
        persistedCourses: [
          course(10, 9328, { nameEn: null }),
          course(20, 1637214764),
        ],
      }),
    ).toEqual([]);
  });

  it("keeps same-code classification variants separate", () => {
    expect(
      planCourseDuplicateMerges({
        canonicalJwIds: new Set([9328]),
        incomingSourceJwIds: new Set([9328]),
        persistedCourses: [
          course(10, 9328),
          course(20, 1637214764, { categoryId: 9 }),
        ],
      }),
    ).toEqual([]);
  });

  it("fails closed when a stale row has multiple compatible canonical matches", () => {
    expect(() =>
      planCourseDuplicateMerges({
        canonicalJwIds: new Set([9328, 12000]),
        incomingSourceJwIds: new Set([9328, 12000]),
        persistedCourses: [
          course(10, 9328),
          course(11, 12000),
          course(20, 1637214764, { nameEn: null }),
        ],
      }),
    ).toThrow("Ambiguous legacy Course 1637214764");
  });
});
