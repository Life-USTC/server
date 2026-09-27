import { describe, expect, test } from "vitest";
import {
  currentNewsItem,
  currentYoungItem,
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

  test("adds the open news article and young event or organizer", () => {
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
    expect(
      currentYoungItem("/catalog/young-events/calendar", {
        event: { name: "日历", youngId: "calendar" },
      }),
    ).toBeNull();
    expect(
      currentYoungItem("/catalog/young-events/event-1", {
        event: { name: "示例活动", youngId: "event-1" },
      }),
    ).toEqual({
      href: "/catalog/young-events/event-1",
      label: "示例活动",
    });
    expect(
      currentYoungItem("/catalog/young-events/organizers/club", {
        organizer: { id: "club", name: "学生会" },
      }),
    ).toEqual({
      href: "/catalog/young-events/organizers/club",
      label: "学生会",
    });
  });
});
