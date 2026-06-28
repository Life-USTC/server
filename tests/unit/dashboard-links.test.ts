import { describe, expect, it } from "vitest";
import {
  linkMatchesTokens,
  searchQueryToTokens,
} from "@/features/dashboard-links/lib/dashboard-link-search";
import {
  localizeDashboardLink,
  recommendDashboardLinks,
  USTC_DASHBOARD_LINKS,
} from "@/features/dashboard-links/lib/dashboard-links";
import { buildDashboardLinkSummaries } from "@/features/dashboard-links/server/dashboard-link-selection";

describe("仪表盘链接推荐", () => {
  it("按点击次数降序返回链接", () => {
    const result = recommendDashboardLinks({
      mail: 2,
      jw: 8,
      library: 3,
      network: 1,
    });

    expect(result.map((item) => item.slug)).toEqual(["jw", "library", "mail"]);
  });

  it("无历史记录时回退到确定性顺序", () => {
    const result = recommendDashboardLinks({});

    expect(result).toHaveLength(3);
    expect(
      result.every((item) =>
        USTC_DASHBOARD_LINKS.some((link) => link.slug === item.slug),
      ),
    ).toBe(true);
  });

  it("支持排除 slug 和自定义数量限制", () => {
    const result = recommendDashboardLinks(
      {
        jw: 10,
        library: 7,
        mail: 6,
        official: 2,
      },
      { excludeSlugs: ["jw", "library"], limit: 2 },
    );

    expect(result.map((item) => item.slug)).toEqual(["mail", "official"]);
  });

  it("要求每个链接都有英文目录标签", () => {
    for (const link of USTC_DASHBOARD_LINKS) {
      expect(link.localizations["en-us"]?.title, link.slug).toBeTruthy();
      expect(link.localizations["en-us"]?.description, link.slug).toBeTruthy();
    }
  });

  it("按地区设置投影仪表盘链接标签", () => {
    const mail = USTC_DASHBOARD_LINKS.find((link) => link.slug === "mail");
    expect(mail).toBeDefined();
    if (!mail) throw new Error("mail link missing");

    expect(localizeDashboardLink(mail, "zh-cn")).toMatchObject({
      title: "邮箱",
      description: "USTC 邮件系统。",
    });
    expect(localizeDashboardLink(mail, "en-us")).toMatchObject({
      title: "USTC Email",
      description: "USTC email service.",
    });
  });

  it("根据本地化链接标签构建搜索摘要", () => {
    const zhLinks = buildDashboardLinkSummaries({}, new Set(), "zh-cn");
    const enLinks = buildDashboardLinkSummaries({}, new Set(), "en-us");
    const zhMail = zhLinks.dashboardLinks.find((link) => link.slug === "mail");
    const enMail = enLinks.dashboardLinks.find((link) => link.slug === "mail");

    expect(zhMail?.title).toBe("邮箱");
    expect(enMail?.title).toBe("USTC Email");
    expect(
      zhMail
        ? linkMatchesTokens(zhMail, searchQueryToTokens("youxiang"))
        : false,
    ).toBe(true);
    expect(
      enMail ? linkMatchesTokens(enMail, searchQueryToTokens("email")) : false,
    ).toBe(true);
  });
});
