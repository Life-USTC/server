import { describe, expect, it } from "vitest";
import { GLOBAL_SEARCH_GROUP_ORDER } from "@/features/search/server/global-search-types";

describe("global search group order", () => {
  it("ranks teachers before sections and links after sections", () => {
    expect(GLOBAL_SEARCH_GROUP_ORDER.indexOf("teachers")).toBeLessThan(
      GLOBAL_SEARCH_GROUP_ORDER.indexOf("sections"),
    );
    expect(GLOBAL_SEARCH_GROUP_ORDER.indexOf("sections")).toBeLessThan(
      GLOBAL_SEARCH_GROUP_ORDER.indexOf("links"),
    );
  });
});
