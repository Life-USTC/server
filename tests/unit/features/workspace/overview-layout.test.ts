import { describe, expect, it } from "vitest";
import {
  OVERVIEW_FULL_WIDTH_CLASS,
  overviewListPlacement,
} from "@/features/workspace/lib/overview-layout";

describe("overviewListPlacement", () => {
  it("pairs the two lists in one desktop row when both have items", () => {
    const { paired, list } = overviewListPlacement({
      urgency: 3,
      upcoming: 5,
    });
    expect(paired).toBe(true);
    expect(list.class).toBe("");
    expect(list.wide).toBe(false);
  });

  it("gives a single remaining list the full desktop width", () => {
    for (const counts of [
      { urgency: 0, upcoming: 5 },
      { urgency: 4, upcoming: 0 },
    ]) {
      const { paired, list } = overviewListPlacement(counts);
      expect(paired).toBe(false);
      expect(list.class).toBe(OVERVIEW_FULL_WIDTH_CLASS);
      expect(list.wide).toBe(true);
    }
  });

  it("keeps the desktop split on the shared lg breakpoint", () => {
    expect(OVERVIEW_FULL_WIDTH_CLASS).toBe("lg:col-span-2");
  });
});
