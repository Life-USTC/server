import { describe, expect, test } from "vitest";
import {
  CATALOG_MAX_ID,
  CATALOG_MAX_PAGE,
  CATALOG_SEARCH_MAX_LENGTH,
  CATALOG_TEXT_FILTER_MAX_LENGTH,
  catalogListPageHref,
  isCacheableCatalogListQuery,
  normalizeCatalogListQuery,
} from "@/features/catalog/lib/catalog-list-query";

describe("catalog list query normalization", () => {
  test("normalizes direct course loader input to bounded canonical values", () => {
    const search = "x".repeat(CATALOG_SEARCH_MAX_LENGTH + 20);
    const normalized = normalizeCatalogListQuery(
      "/catalog/courses",
      new URLSearchParams(
        `page=999999&search=%20${search}%20&categoryId=0007&unknown=value`,
      ),
    );

    expect(normalized.get("page")).toBe(String(CATALOG_MAX_PAGE));
    expect(normalized.get("search")).toBe(
      "x".repeat(CATALOG_SEARCH_MAX_LENGTH),
    );
    expect(normalized.get("categoryId")).toBe("7");
    expect(normalized.has("unknown")).toBe(false);
  });

  test("normalizes section text, numeric, sort, and order values", () => {
    const normalized = normalizeCatalogListQuery(
      "/catalog/sections",
      new URLSearchParams({
        campusId: String(CATALOG_MAX_ID + 1),
        courseCode: `  ${"C".repeat(CATALOG_TEXT_FILTER_MAX_LENGTH + 5)}  `,
        credits: "02.50",
        order: "asc",
        semesterId: "0003",
        sort: "CREDITS",
      }),
    );

    expect(normalized.get("campusId")).toBeNull();
    expect(normalized.get("courseCode")).toBe(
      "C".repeat(CATALOG_TEXT_FILTER_MAX_LENGTH),
    );
    expect(normalized.get("credits")).toBe("2.5");
    expect(normalized.get("semesterId")).toBe("3");
    expect(normalized.get("sort")).toBe("credits");
    expect(normalized.get("order")).toBe("asc");
  });

  test("uses the first duplicate value for uncached loader normalization", () => {
    const normalized = normalizeCatalogListQuery(
      "/catalog/teachers",
      new URLSearchParams("departmentId=0007&departmentId=8"),
    );

    expect(normalized.toString()).toBe("departmentId=7");
  });
});

describe("catalog list shared-cache admission", () => {
  test.each([
    ["/catalog/courses", ""],
    ["/catalog/courses", "search=data+science&page=2&categoryId=7"],
    ["/catalog/courses", "search=&educationLevelId=&categoryId=&classTypeId="],
    ["/catalog/sections", "semesterId=3&credits=2.5&sort=credits&order=asc"],
    [
      "/catalog/sections",
      "search=&semesterId=3&teacher=&courseCode=&sectionCode=&campusId=&departmentId=&credits=&categoryId=&educationLevelId=&classTypeId=&sort=",
    ],
    ["/catalog/teachers", `departmentId=${CATALOG_MAX_ID}&page=5000`],
  ] as const)("accepts canonical %s query %s", (pathname, query) => {
    expect(
      isCacheableCatalogListQuery(pathname, new URLSearchParams(query)),
    ).toBe(true);
  });

  test.each([
    ["/catalog/courses", "search=math&search=physics"],
    ["/catalog/courses", "unknown=value"],
    ["/catalog/courses", "page=1"],
    ["/catalog/courses", "page=01"],
    ["/catalog/courses", "page=5001"],
    ["/catalog/courses", "search=%20math"],
    ["/catalog/courses", `search=${"x".repeat(CATALOG_SEARCH_MAX_LENGTH + 1)}`],
    ["/catalog/courses", "categoryId=01"],
    ["/catalog/courses", `categoryId=${CATALOG_MAX_ID + 1}`],
    ["/catalog/teachers", "departmentId=0"],
    ["/catalog/sections", "courseCode=%20MATH"],
    [
      "/catalog/sections",
      `teacher=${"x".repeat(CATALOG_TEXT_FILTER_MAX_LENGTH + 1)}`,
    ],
    ["/catalog/sections", "credits=02.50"],
    ["/catalog/sections", "credits=2e0"],
    ["/catalog/sections", "sort=credits"],
    ["/catalog/sections", "sort=CREDITS&order=asc"],
    ["/catalog/sections", "sort=unknown&order=asc"],
    ["/catalog/sections", "order=desc"],
  ] as const)("rejects non-canonical %s query %s", (pathname, query) => {
    expect(
      isCacheableCatalogListQuery(pathname, new URLSearchParams(query)),
    ).toBe(false);
  });
});

describe("catalogListPageHref", () => {
  test("preserves section filters when changing page", () => {
    const href = catalogListPageHref(
      new URL(
        "https://example.test/catalog/sections?semesterId=3&teacher=%E5%BC%A0&sort=code&order=desc&search=math",
      ),
      2,
    );

    expect(href).toBe(
      "/catalog/sections?order=desc&page=2&search=math&semesterId=3&sort=code&teacher=%E5%BC%A0",
    );
  });

  test("drops page=1 and keeps course filters", () => {
    const href = catalogListPageHref(
      new URL(
        "https://example.test/catalog/courses?categoryId=7&search=algo&page=4",
      ),
      1,
    );

    expect(href).toBe("/catalog/courses?categoryId=7&search=algo");
  });
});
