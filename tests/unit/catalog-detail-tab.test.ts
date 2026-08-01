import { describe, expect, test } from "vitest";
import {
  courseDetailPagePath,
  parseCatalogDetailTab,
  resolveCatalogDetailTabRedirect,
  teacherDetailPagePath,
} from "@/features/catalog/lib/catalog-detail-tab";

function request(path: string) {
  return new Request(`https://life-ustc.test${path}`, {
    headers: { accept: "text/html" },
  });
}

describe("catalog detail tab helpers", () => {
  test.each([
    [undefined, "overview"],
    [null, "overview"],
    ["introduction", "introduction"],
    ["sections", "sections"],
    ["comments", "comments"],
    ["invalid", "overview"],
  ] as const)("parseCatalogDetailTab(%s) -> %s", (value, expected) => {
    expect(parseCatalogDetailTab(value)).toBe(expected);
  });

  test.each([
    [123, "overview", "/catalog/courses/123"],
    [123, "introduction", "/catalog/courses/123?tab=introduction"],
    [456, "comments", "/catalog/courses/456?tab=comments"],
  ] as const)("courseDetailPagePath(%s, %s) -> %s", (jwId, tab, expected) => {
    expect(courseDetailPagePath(jwId, tab)).toBe(expected);
  });

  test.each([
    [42, "overview", "/catalog/teachers/42"],
    [42, "sections", "/catalog/teachers/42?tab=sections"],
  ] as const)("teacherDetailPagePath(%s, %s) -> %s", (id, tab, expected) => {
    expect(teacherDetailPagePath(id, tab)).toBe(expected);
  });

  test("redirects legacy course tab paths to shell query tabs", () => {
    expect(
      resolveCatalogDetailTabRedirect(
        request("/catalog/courses/123/introduction?foo=bar"),
        "courses",
      ),
    ).toBe("/catalog/courses/123?foo=bar&tab=introduction");
  });

  test("redirects legacy teacher tab paths to shell query tabs", () => {
    expect(
      resolveCatalogDetailTabRedirect(
        request("/catalog/teachers/9/comments"),
        "teachers",
      ),
    ).toBe("/catalog/teachers/9?tab=comments");
  });

  test("ignores unknown legacy segments", () => {
    expect(
      resolveCatalogDetailTabRedirect(
        request("/catalog/courses/123/overview"),
        "courses",
      ),
    ).toBeNull();
  });
});
