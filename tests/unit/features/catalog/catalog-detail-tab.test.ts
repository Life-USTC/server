import { describe, expect, test } from "vitest";
import {
  courseDetailPagePath,
  parseCatalogDetailTab,
  resolveCatalogDetailTabQueryRedirect,
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
    [123, undefined, "/catalog/courses/123"],
    [123, "overview", "/catalog/courses/123/overview"],
    [123, "introduction", "/catalog/courses/123/introduction"],
    [456, "comments", "/catalog/courses/456/comments"],
  ] as const)("courseDetailPagePath(%s, %s) -> %s", (jwId, tab, expected) => {
    expect(courseDetailPagePath(jwId, tab)).toBe(expected);
  });

  test.each([
    [42, undefined, "/catalog/teachers/42"],
    [42, "overview", "/catalog/teachers/42/overview"],
    [42, "sections", "/catalog/teachers/42/sections"],
  ] as const)("teacherDetailPagePath(%s, %s) -> %s", (id, tab, expected) => {
    expect(teacherDetailPagePath(id, tab)).toBe(expected);
  });

  test("strips tab query on canonical course URLs", () => {
    expect(
      resolveCatalogDetailTabQueryRedirect(
        request("/catalog/courses/123?tab=introduction&foo=1"),
        "courses",
      ),
    ).toBe("/catalog/courses/123/introduction?foo=1");
  });

  test("retains the explicitly selected overview tab", () => {
    expect(
      resolveCatalogDetailTabQueryRedirect(
        request("/catalog/courses/123?tab=overview"),
        "courses",
      ),
    ).toBe("/catalog/courses/123/overview");
  });
});
