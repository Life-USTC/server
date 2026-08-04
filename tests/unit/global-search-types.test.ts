import { describe, expect, it } from "vitest";
import { GLOBAL_SEARCH_GROUP_ORDER } from "@/features/search/server/global-search-types";

describe("global search group order", () => {
  it("ranks sections first, then teachers, courses, and links", () => {
    expect(GLOBAL_SEARCH_GROUP_ORDER.indexOf("sections")).toBe(0);
    expect(GLOBAL_SEARCH_GROUP_ORDER.indexOf("teachers")).toBeLessThan(
      GLOBAL_SEARCH_GROUP_ORDER.indexOf("courses"),
    );
    expect(GLOBAL_SEARCH_GROUP_ORDER.indexOf("courses")).toBeLessThan(
      GLOBAL_SEARCH_GROUP_ORDER.indexOf("links"),
    );
  });
});
