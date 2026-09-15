import { describe, expect, it } from "vitest";
import { findClosestMatches } from "@/lib/fuzzy-match";

describe("findClosestMatches", () => {
  it("过滤仅共享短通用前缀的无关 section code", () => {
    expect(
      findClosestMatches("DEV-CS201.0", [
        "DEV-CS201.01",
        "DEV-MA212.02",
        "DEV-PH230.03",
      ]),
    ).toEqual(["DEV-CS201.01"]);
  });

  it("为无数字的 3 字符代码返回建议（回退 chunk 路径）", () => {
    // "MAT" has no digit so is not a "significant" chunk; the code falls back
    // to using it as the lookup prefix anyway, so matches should still surface.
    const result = findClosestMatches("MAT", ["MAT201", "MAT101", "PHYSABC"]);
    expect(result).toContain("MAT201");
    expect(result).toContain("MAT101");
    expect(result).not.toContain("PHYSABC");
  });

  it("为带数字的 3 字符代码返回建议（有效 chunk 路径）", () => {
    // "201" has a digit so is a significant chunk; candidates sharing the token
    // should be preferred over unrelated ones.
    const result = findClosestMatches("MA201", [
      "MA201.01",
      "MA201.02",
      "PH230.03",
    ]);
    expect(result).toContain("MA201.01");
    expect(result).not.toContain("PH230.03");
  });
});
