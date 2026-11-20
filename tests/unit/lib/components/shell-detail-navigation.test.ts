import { describe, expect, it } from "vitest";
import {
  activeDetailTab,
  detailNavigation,
  detailTabIds,
  legacyDetailDestination,
} from "@/lib/components/shell/detail-navigation";
import { shellPresentation } from "@/lib/components/shell/shell-templates";
import { buildLayoutCopy } from "@/lib/shell/layout-server-data";

const copy = buildLayoutCopy("en-us");
describe("route-owned shell capabilities", () => {
  it("keeps academic nested scrolling explicit and makes legal links available in every full template", () => {
    expect(shellPresentation("academic-detail", false)).toMatchObject({
      detailScroll: true,
      edgeToEdge: true,
      footer: "sidebar",
      focused: false,
    });
    for (const template of ["workspace", "settings"])
      expect(shellPresentation(template, true)).toMatchObject({
        detailScroll: false,
        footer: "sidebar",
        focused: false,
      });
    for (const template of ["standard", "young-detail"])
      expect(shellPresentation(template, false).footer).toBe("public");
    expect(shellPresentation("focused", false)).toMatchObject({
      focused: true,
      footer: "none",
    });
    expect(shellPresentation("home", false).footer).toBe("public");
    expect(shellPresentation("home", true).footer).toBe("sidebar");
    expect(shellPresentation("/catalog/courses/400", false)).toEqual(
      shellPresentation("standard", false),
    );
  });
  it("uses the collection as canonical parent and the true course jwId as a section relation", () => {
    const model = detailNavigation(
      {
        shellDetail: "section",
        section: {
          code: "not-an-id",
          course: { jwId: 400, nameCn: "Course name" },
        },
      },
      "/catalog/sections/1800",
      copy,
    );
    expect(model).toMatchObject({
      collection: { href: "/catalog/sections" },
      current: { href: "/catalog/sections/1800", label: "Course name" },
      courseHref: "/catalog/courses/400",
    });
    expect(
      model?.current.items.map((item) =>
        new URL(item.href, "https://life.example").pathname.split("/").at(-1),
      ),
    ).toEqual([
      "introduction",
      "calendar",
      "exams",
      "homework",
      "comments",
      "overview",
    ]);
  });
  it.each(["400/another", null, 0, -1, {}])(
    "never guesses a course identifier from %s",
    (jwId) => {
      const model = detailNavigation(
        {
          shellDetail: "section",
          section: { code: "400", course: { jwId, nameCn: "Course" } },
        },
        "/catalog/sections/1800",
        copy,
      );
      expect(model?.courseHref).toBeNull();
    },
  );
  it("keeps the demo course relation available across detail tabs", () => {
    expect(
      detailNavigation(
        {
          shellDetail: "section",
          demo: { mode: "sample" },
          section: { course: { jwId: 400, nameCn: "Course" } },
        },
        "/catalog/sections/1800",
        copy,
      )?.courseHref,
    ).toBe("/catalog/courses/400");
  });
  it("lists only tabs owned by the declared detail kind", () => {
    expect(detailTabIds("course")).not.toContain("calendar");
    expect(detailTabIds("section")).toContain("calendar");
    expect(detailTabIds(undefined)).toEqual([]);
  });
  it("requires explicit detail metadata and creates only same-entity tab links", () => {
    expect(
      detailNavigation(
        { course: { nameCn: "Course" } },
        "/catalog/courses/400",
        copy,
      ),
    ).toBeNull();
    for (const [kind, entity, path] of [
      ["course", "course", "/catalog/courses/400"],
      ["teacher", "teacher", "/catalog/teachers/900"],
    ]) {
      const model = detailNavigation(
        { shellDetail: kind, [entity]: { nameCn: "Name" } },
        path,
        copy,
      );
      expect(
        model?.current.items.map((item) =>
          new URL(item.href, "https://life.example").pathname.split("/").at(-1),
        ),
      ).toEqual(["introduction", "sections", "comments", "overview"]);
      expect(model?.courseHref).toBeNull();
    }
  });
  it("limits the focused homework parameter to its own tab", () => {
    const section = detailNavigation(
      { shellDetail: "section", section: { course: { nameCn: "Course" } } },
      "/catalog/sections/1800",
      copy,
      "?homeworkId=42&source=calendar",
    );
    expect(
      section?.current.items.find((link) => link.detail?.tab === "homework")
        ?.href,
    ).toBe("/catalog/sections/1800/homework?homeworkId=42&source=calendar");
    expect(
      section?.current.items.find((link) => link.detail?.tab === "comments")
        ?.href,
    ).toBe("/catalog/sections/1800/comments?source=calendar");
  });

  it.each([
    ["section", "", "introduction"],
    ["section", "?homeworkId=42", "homework"],
    ["section", "?homeworkId=42#introduction", "introduction"],
    ["section", "?homeworkId=42#comment-reply", "homework"],
    ["section", "#comment-reply", "comments"],
    ["section", "#teachers", "overview"],
    ["course", "#calendar", "introduction"],
    ["course", "#comment-abc", "comments"],
    ["teacher", "?sectionsPage=2#sections", "sections"],
  ] as const)("selects the %s panel from %s", (kind, suffix, tab) => {
    expect(
      activeDetailTab(
        kind,
        new URL(
          legacyDetailDestination(
            kind,
            new URL(`https://life.example/catalog/sections/42${suffix}`),
          ) ?? "/catalog/sections/42",
          "https://life.example",
        ),
      ),
    ).toBe(tab);
  });
});
