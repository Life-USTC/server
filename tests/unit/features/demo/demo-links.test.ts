import { describe, expect, it } from "vitest";
import { groupCatalogLinks } from "@/features/catalog-links/lib/catalog-link-search";
import { getDemoHomeOverview } from "@/features/demo/server/demo-home";
import { getDemoCatalogLinksData } from "@/features/demo/server/demo-links";
import { getDemoWorkspacePage } from "@/features/demo/server/demo-workspace";
import {
  filterLinkGroups,
  linkTableFields,
} from "@/features/workspace/lib/link-table-filters";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";

const identity = {
  fixtureVersion: "workspace-v1",
  expiresAt: 1_800_000_000_000,
} as const;

describe("fixed Demo website preferences", () => {
  for (const locale of ["en-us", "zh-cn"] as const) {
    it(`preserves the public catalog with explicitly fictional personal facts in ${locale}`, () => {
      const data = getDemoCatalogLinksData(locale);
      expect(Object.keys(data).sort()).toEqual([
        "catalogLinks",
        "overviewLinks",
        "pinnedLinks",
        "recommendedLinks",
      ]);
      expect(data.catalogLinks).toHaveLength(65);
      expect(new Set(data.catalogLinks.map((link) => link.slug)).size).toBe(65);
      expect(
        data.catalogLinks
          .filter((link) => link.isPinned)
          .map((link) => link.slug)
          .sort(),
      ).toEqual(["jw", "library"]);
      expect(
        Object.fromEntries(
          data.catalogLinks
            .filter((link) => link.clickCount !== 0)
            .map((link) => [link.slug, link.clickCount]),
        ),
      ).toEqual({ jw: 12, library: 7, mail: 4, icourse: 2 });
      expect(
        data.catalogLinks.every(
          (link) =>
            Number.isSafeInteger(link.clickCount) && link.clickCount >= 0,
        ),
      ).toBe(true);
      const expected = [
        [
          "jw",
          "https://jw.ustc.edu.cn/",
          locale === "en-us" ? "Academic Affairs System" : "教务系统",
        ],
        [
          "library",
          "https://lib.ustc.edu.cn/",
          locale === "en-us" ? "Library" : "图书馆",
        ],
        [
          "mail",
          "https://mail.ustc.edu.cn/",
          locale === "en-us" ? "USTC Email" : "邮箱",
        ],
        [
          "icourse",
          "https://icourse.club/",
          locale === "en-us" ? "iCourse Review Community" : "评课社区",
        ],
      ];
      for (const [slug, url, title] of expected)
        expect(
          data.catalogLinks.find((link) => link.slug === slug),
        ).toMatchObject({ slug, url, title, group: "mostClicked" });
    });

    it(`shares pin order, recommendations and overview facts across pages in ${locale}`, () => {
      const data = getDemoCatalogLinksData(locale);
      expect(data.pinnedLinks.map((link) => link.slug)).toEqual([
        "jw",
        "library",
      ]);
      expect(data.recommendedLinks).toHaveLength(63);
      expect(new Set(data.recommendedLinks.map((link) => link.slug)).size).toBe(
        63,
      );
      expect(data.recommendedLinks.every((link) => !link.isPinned)).toBe(true);
      expect(
        data.recommendedLinks.slice(0, 2).map((link) => link.slug),
      ).toEqual(["mail", "icourse"]);
      expect(data.overviewLinks.map((link) => link.slug)).toEqual([
        "jw",
        "library",
        "mail",
        "icourse",
      ]);
      for (const list of [
        data.pinnedLinks,
        data.recommendedLinks,
        data.overviewLinks,
      ])
        for (const link of list)
          expect(link).toEqual(
            data.catalogLinks.find((item) => item.slug === link.slug),
          );
      const home = getDemoHomeOverview(identity, locale);
      expect(home).not.toBeNull();
      expect(home?.overview.overviewLinks).toEqual(data.overviewLinks);
      expect(
        getDemoWorkspacePage(identity, locale, "calendar").overview
          ?.overviewLinks,
      ).toEqual(data.overviewLinks);
    });

    it(`supports existing text, pin and numeric filters over the sample facts in ${locale}`, () => {
      const data = getDemoCatalogLinksData(locale);
      const copy = getWorkspacePageCopy(locale);
      const groups = groupCatalogLinks(
        data.catalogLinks,
        "",
        copy.workspace.linkHub.groups,
      );
      const fields = linkTableFields(
        copy.workspace.linkHub,
        copy.common.tableFilters,
        true,
      );
      const filtered = (values: Record<string, string>) =>
        filterLinkGroups(groups, [...fields.columns, ...fields.extras], values)
          .flatMap((group) => group.links.map((link) => link.slug))
          .sort();
      expect(filtered({ isPinned: "true" })).toEqual(["jw", "library"]);
      expect(filtered({ clickCount: "7", clickCountOp: "gt" })).toEqual(["jw"]);
      expect(
        filtered({ isPinned: "false", clickCount: "3", clickCountOp: "gte" }),
      ).toEqual(["mail"]);
      expect(filtered({ url: "jw.ustc.edu.cn" })).toEqual(["jw"]);
      expect(filtered({ title: "no-such-demo-campus-website" })).toEqual([]);
      expect(
        groupCatalogLinks(
          data.catalogLinks,
          locale === "en-us" ? "Library" : "tushuguan",
          copy.workspace.linkHub.groups,
        ).flatMap((group) => group.links.map((link) => link.slug)),
      ).toEqual(["library", "study-space-booking"]);
    });
  }

  it("does not let one response mutate later requests or another locale", () => {
    const data = getDemoCatalogLinksData("en-us");
    const jw = data.catalogLinks.find((link) => link.slug === "jw");
    if (!jw) throw new Error("The sample needs Academic Affairs");
    jw.clickCount = 999;
    jw.isPinned = false;
    jw.title = "private prior response";
    data.pinnedLinks.splice(0);
    data.overviewLinks.reverse();
    for (const locale of ["en-us", "zh-cn"] as const) {
      const next = getDemoCatalogLinksData(locale);
      expect(
        next.catalogLinks.find((link) => link.slug === "jw"),
      ).toMatchObject({ clickCount: 12, isPinned: true });
      expect(next.pinnedLinks.map((link) => link.slug)).toEqual([
        "jw",
        "library",
      ]);
      expect(next.overviewLinks.map((link) => link.slug)).toEqual([
        "jw",
        "library",
        "mail",
        "icourse",
      ]);
      expect(JSON.stringify(next)).not.toContain("private prior response");
    }
  });
});
