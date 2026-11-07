import { describe, expect, it } from "vitest";
import {
  detailAnchorIds,
  detailNavigation,
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
    expect(model?.anchors.map((item) => item.href)).toEqual([
      "#introduction",
      "#calendar",
      "#exams",
      "#homework",
      "#comments",
      "#overview",
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
  it("does not duplicate the demo description's existing course relation", () => {
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
    ).toBeNull();
  });
  it("restores only an anchor owned by the declared detail kind", () => {
    expect(detailAnchorIds("course")).not.toContain("calendar");
    expect(detailAnchorIds("section")).toContain("calendar");
    expect(detailAnchorIds(undefined)).toEqual([]);
  });
  it("requires explicit detail metadata and creates only same-page content anchors", () => {
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
      expect(model?.anchors.map((item) => item.href)).toEqual([
        "#introduction",
        "#sections",
        "#comments",
        "#overview",
      ]);
      expect(model?.courseHref).toBeNull();
    }
  });
});
