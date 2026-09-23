import { describe, expect, it } from "vitest";
import { searchLinksForGlobal } from "@/features/search/server/global-search-link-queries";

describe("searchLinksForGlobal", () => {
  it("matches localized link titles", () => {
    const results = searchLinksForGlobal("邮箱", "zh-cn", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((link) => link.title.includes("邮箱"))).toBe(true);
  });

  it("matches Chinese queries against English locale results", () => {
    const results = searchLinksForGlobal("邮箱", "en-us", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((link) => link.title.includes("USTC Email"))).toBe(
      true,
    );
  });

  it("returns empty results for short queries", () => {
    expect(searchLinksForGlobal("a", "zh-cn", 5)).toEqual([]);
  });
});
