import { describe, expect, it } from "vitest";
import {
  localizedNamePrimary,
  localizedNameSecondary,
  toLocalizedNameDto,
} from "@/lib/localized-name";

describe("localized name projection", () => {
  it("uses Chinese as primary for zh-cn and English as secondary", () => {
    expect(
      toLocalizedNameDto(
        { nameCn: "高等数学", nameEn: "Advanced Mathematics" },
        "zh-cn",
      ),
    ).toEqual({
      nameCn: "高等数学",
      nameEn: "Advanced Mathematics",
      namePrimary: "高等数学",
      nameSecondary: "Advanced Mathematics",
    });
  });

  it("uses a non-blank English name as primary for en-us", () => {
    expect(
      localizedNamePrimary("en-us", "高等数学", " Advanced Mathematics "),
    ).toBe("Advanced Mathematics");
    expect(
      localizedNameSecondary("en-us", "高等数学", " Advanced Mathematics "),
    ).toBe("高等数学");
  });

  it("falls back to Chinese without inventing a secondary name", () => {
    expect(
      toLocalizedNameDto({ nameCn: "高等数学", nameEn: "  " }, "en-us"),
    ).toEqual({
      nameCn: "高等数学",
      nameEn: "  ",
      namePrimary: "高等数学",
      nameSecondary: null,
    });
  });
});
