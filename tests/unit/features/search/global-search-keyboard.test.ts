import { describe, expect, it } from "vitest";
import {
  flattenSearchGroups,
  moveSearchActiveIndex,
} from "@/features/search/lib/global-search-keyboard";

describe("global search keyboard", () => {
  it("flattens grouped items in display order", () => {
    const items = flattenSearchGroups([
      {
        type: "teachers",
        items: [{ id: "teacher:1", title: "A", description: null, href: "/a" }],
      },
      {
        type: "sections",
        items: [{ id: "section:2", title: "B", description: null, href: "/b" }],
      },
    ]);

    expect(items.map((item) => item.id)).toEqual(["teacher:1", "section:2"]);
  });

  it("moves selection down from input to first item", () => {
    expect(moveSearchActiveIndex(3, -1, "down")).toBe(0);
    expect(moveSearchActiveIndex(3, 0, "down")).toBe(1);
  });

  it("moves selection up from first item back to input", () => {
    expect(moveSearchActiveIndex(3, 0, "up")).toBe(-1);
    expect(moveSearchActiveIndex(3, 2, "up")).toBe(1);
  });
});
