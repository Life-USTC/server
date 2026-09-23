import { describe, expect, test } from "vitest";
import {
  catalogLocalizedDisplayName,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";

describe("catalogLocalizedDisplayName", () => {
  const bilingual = {
    namePrimary: "微分几何",
    nameSecondary: "Differential Geometry",
  };
  const enPrimary = {
    namePrimary: "Differential Geometry",
    nameSecondary: "微分几何",
  };

  test("zh-cn shows primary only", () => {
    expect(catalogLocalizedDisplayName(bilingual, "zh-cn")).toBe("微分几何");
  });

  test("zh-cn falls back to secondary when primary is missing", () => {
    expect(
      catalogLocalizedDisplayName(
        { namePrimary: "", nameSecondary: "Differential Geometry" },
        "zh-cn",
      ),
    ).toBe("Differential Geometry");
  });

  test("en-us shows primary (secondary)", () => {
    expect(catalogLocalizedDisplayName(enPrimary, "en-us")).toBe(
      "Differential Geometry (微分几何)",
    );
  });

  test("en-us omits parentheses when names match", () => {
    expect(
      catalogLocalizedDisplayName(
        { namePrimary: "Math", nameSecondary: "Math" },
        "en-us",
      ),
    ).toBe("Math");
  });

  test("catalogLocalizedNames joins with the same rule", () => {
    expect(catalogLocalizedNames([enPrimary, enPrimary], "en-us")).toBe(
      "Differential Geometry (微分几何), Differential Geometry (微分几何)",
    );
    expect(catalogLocalizedNames([bilingual], "zh-cn")).toBe("微分几何");
  });
});
