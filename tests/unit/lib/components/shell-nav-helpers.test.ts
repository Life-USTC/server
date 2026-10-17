import { describe, expect, test } from "vitest";
import {
  currentCatalogDetailItem,
  currentNewsItem,
} from "@/lib/components/shell/shell-nav-helpers";

describe("shell branch navigation", () => {
  test.each([
    [
      "/catalog/courses",
      { course: { namePrimary: "  Linear Algebra  " } },
      "Linear Algebra",
    ],
    [
      "/catalog/sections",
      { section: { course: { nameCn: "线性代数" } } },
      "线性代数",
    ],
    ["/catalog/teachers", { teacher: { name: "Teacher" } }, "Teacher"],
  ] as const)(
    "adds only the open record under %s",
    (collection, data, label) => {
      expect(
        currentCatalogDetailItem(collection, `${collection}/12`, data),
      ).toEqual({ href: `${collection}/12`, label });
      expect(
        currentCatalogDetailItem(
          collection,
          `${collection}/12/description`,
          data,
        ),
      ).toEqual({ href: `${collection}/12`, label });
      expect(
        currentCatalogDetailItem(collection, "/workspace/subscriptions", data),
      ).toBeNull();
      expect(currentCatalogDetailItem(collection, collection, data)).toBeNull();
      expect(
        currentCatalogDetailItem(collection, `${collection}/12`, {}),
      ).toBeNull();
    },
  );

  test("never puts a different collection's record under Sections", () => {
    expect(
      currentCatalogDetailItem("/catalog/sections", "/catalog/courses/12", {
        course: { name: "Course" },
      }),
    ).toBeNull();
  });

  test("adds the open news article beside the source directory", () => {
    expect(
      currentNewsItem("/news/sources", {
        publication: { id: "sources", revision: { title: "来源" } },
      }),
    ).toBeNull();
    expect(
      currentNewsItem("/news/article-1", {
        publication: { id: "article-1", revision: { title: "校园通知" } },
      }),
    ).toEqual({ href: "/news/article-1", label: "校园通知" });
    expect(currentNewsItem("/news/article-1", {})).toBeNull();
  });
});
