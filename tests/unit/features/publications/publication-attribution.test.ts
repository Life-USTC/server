import { describe, expect, it } from "vitest";
import { publicationAttributionValue } from "@/features/publications/lib/publication-attribution";

describe("publicationAttributionValue", () => {
  it.each([
    null,
    undefined,
    "",
    "  ",
    "网站",
    "栏目",
    "首页",
    "未知",
    "Site",
    "category",
    "—",
    "-",
    "https://news.ustc.edu.cn/column",
    "...",
  ])("filters invalid site/栏目 noise: %s", (value) => {
    expect(publicationAttributionValue(value)).toBeNull();
  });

  it("keeps useful attribution labels", () => {
    expect(publicationAttributionValue("综合新闻")).toBe("综合新闻");
    expect(publicationAttributionValue(" 张三 ")).toBe("张三");
  });
});
