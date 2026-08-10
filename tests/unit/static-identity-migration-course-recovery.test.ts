import { describe, expect, it } from "vitest";
import { isLegacySyntheticCourseJwId } from "@/static-loader/identity-migration/legacy-course-identity";
import { RECOVERED_RAW_COURSE_JW_IDS } from "@/static-loader/identity-migration/legacy-course-recovery";

describe("legacy Course recovery", () => {
  it("contains one unique raw target for every verified synthetic identity", () => {
    expect(RECOVERED_RAW_COURSE_JW_IDS.size).toBe(71);
    expect(new Set(RECOVERED_RAW_COURSE_JW_IDS.values()).size).toBe(71);
    for (const [syntheticJwId, rawJwId] of RECOVERED_RAW_COURSE_JW_IDS) {
      expect(isLegacySyntheticCourseJwId(syntheticJwId)).toBe(true);
      expect(isLegacySyntheticCourseJwId(rawJwId)).toBe(false);
    }
  });

  it("pins representative official catalog identities", () => {
    expect(RECOVERED_RAW_COURSE_JW_IDS.get(1_799_472_844)).toBe(7_816);
    expect(RECOVERED_RAW_COURSE_JW_IDS.get(1_719_040_844)).toBe(142_866);
    expect(RECOVERED_RAW_COURSE_JW_IDS.get(1_623_423_958)).toBe(143_302);
  });
});
