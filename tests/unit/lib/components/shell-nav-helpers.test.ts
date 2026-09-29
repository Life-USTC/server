import { describe, expect, test } from "vitest";
import {
  currentNewsItem,
  sectionDirectoryItems,
} from "@/lib/components/shell/shell-nav-helpers";

describe("shell branch navigation", () => {
  test("lists subscribed sections and adds the open section once", () => {
    const subscribed = [
      { href: "/catalog/sections/11", label: "线性代数" },
      { href: "/catalog/sections/22", label: "密码工程" },
    ];

    expect(
      sectionDirectoryItems("/workspace/overview", {}, subscribed).map(
        (item) => item.label,
      ),
    ).toEqual(["线性代数", "密码工程"]);
    expect(
      sectionDirectoryItems(
        "/catalog/sections/22",
        { section: { course: { namePrimary: "密码工程" } } },
        subscribed,
      ).map((item) => item.href),
    ).toEqual(["/catalog/sections/11", "/catalog/sections/22"]);
    expect(
      sectionDirectoryItems(
        "/catalog/sections/33",
        { section: { course: { namePrimary: "编译原理" } } },
        subscribed,
      ).at(-1),
    ).toEqual({ href: "/catalog/sections/33", label: "编译原理" });
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
  });
});
