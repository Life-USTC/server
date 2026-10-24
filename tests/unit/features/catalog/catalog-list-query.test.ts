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
  test("canonicalizes bounded multi-select IDs and rejects malformed lists atomically", () => {
    const query = normalizeCatalogListQuery(
      "/catalog/teachers",
      new URLSearchParams({
        departmentId: " 03,1,03,2 ",
        teacherTitleId: "1,nope,3",
        name: " 王 ",
        code: " T ",
        email: " example.test ",
      }),
    );
    expect(Object.fromEntries(query)).toEqual({
      departmentId: "1,2,3",
      name: "王",
      code: "T",
      email: "example.test",
    });
    expect(
      normalizeCatalogListQuery(
        "/catalog/courses",
        new URLSearchParams({
          categoryId: Array.from({ length: 101 }, (_, i) => String(i + 1)).join(
            ",",
          ),
        }),
      ).has("categoryId"),
    ).toBe(false);
  });

  test("normalizes complete numeric comparisons and rejects malformed ranges", () => {
    const query = normalizeCatalogListQuery(
      "/catalog/sections",
      new URLSearchParams({
        credits: "02.50",
        creditsOp: "between",
        creditsMax: "4.00",
        stdCount: "01",
        stdCountOp: "gte",
        limitCount: "3.5",
        limitCountOp: "lt",
        teacherCount: "2",
        teacherCountOp: "between",
        teacherCountMax: "1",
        courseName: " Algebra ",
      }),
    );
    expect(Object.fromEntries(query)).toEqual({
      credits: "2.5",
      creditsOp: "between",
      creditsMax: "4",
      stdCount: "1",
      stdCountOp: "gte",
      courseName: "Algebra",
    });
    for (const operator of ["eq", "ne", "gt", "gte", "lt", "lte"]) {
      const result = normalizeCatalogListQuery(
        "/catalog/teachers",
        new URLSearchParams({
          sectionCount: "0",
          sectionCountOp: operator,
          sectionCountMax: "99",
        }),
      );
      expect(result.get("sectionCount")).toBe("0");
      expect(result.get("sectionCountOp")).toBe(
        operator === "eq" ? null : operator,
      );
      expect(result.has("sectionCountMax")).toBe(false);
    }
    expect(
      normalizeCatalogListQuery(
        "/catalog/sections",
        new URLSearchParams("credits=3&creditsOp=invalid"),
      ).has("credits"),
    ).toBe(false);
  });
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
  test("admits canonical multi-selection and comparisons without merging distinct values", () => {
    expect(
      isCacheableCatalogListQuery(
        "/catalog/teachers",
        new URLSearchParams(
          "departmentId=1,2&sectionCount=0&sectionCountOp=between&sectionCountMax=2",
        ),
      ),
    ).toBe(true);
    expect(
      isCacheableCatalogListQuery(
        "/catalog/teachers",
        new URLSearchParams("departmentId=2,1"),
      ),
    ).toBe(false);
    expect(
      isCacheableCatalogListQuery(
        "/catalog/teachers",
        new URLSearchParams("sectionCount=0&sectionCountOp=between"),
      ),
    ).toBe(false);
    expect(
      normalizeCatalogListQuery(
        "/catalog/teachers",
        new URLSearchParams("sectionCount=0&sectionCountOp=lt"),
      ).toString(),
    ).not.toBe(
      normalizeCatalogListQuery(
        "/catalog/teachers",
        new URLSearchParams("sectionCount=0&sectionCountOp=gt"),
      ).toString(),
    );
  });
  test.each([
    ["/catalog/courses", ""],
    ["/catalog/courses", "search=data+science&page=2&categoryId=7"],
    ["/catalog/courses", "search=&educationLevelId=&categoryId=&classTypeId="],
    ["/catalog/sections", "semesterId=3&credits=2.5&sort=credits&order=asc"],
    [
      "/catalog/sections",
      "search=&semesterId=3&teacher=&courseCode=&sectionCode=&campusId=&departmentId=&credits=&categoryId=&educationLevelId=&classTypeId=&sort=",
    ],
    ["/catalog/teachers", `departmentId=${CATALOG_MAX_ID}&page=100`],
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
    ["/catalog/courses", "page=101"],
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
  test("retains the existing page bound without rewriting filters", () => {
    const url = new URL(
      "https://example.test/catalog/sections?campusId=2,1&credits=3&creditsOp=gte",
    );
    const result = new URL(catalogListPageHref(url, CATALOG_MAX_PAGE + 1), url);
    expect(Object.fromEntries(result.searchParams)).toEqual({
      campusId: "2,1",
      credits: "3",
      creditsOp: "gte",
      page: String(CATALOG_MAX_PAGE),
    });
  });
  test("only changes page and preserves repeated and unknown parameters", () => {
    const url = new URL(
      "https://example.test/catalog/teachers?departmentId=3,1&departmentId=8&future=value&sectionCount=0&sectionCountOp=ne&page=2",
    );
    const result = new URL(catalogListPageHref(url, 3), url);
    expect(result.searchParams.getAll("departmentId")).toEqual(["3,1", "8"]);
    expect(result.searchParams.get("future")).toBe("value");
    expect(result.searchParams.get("sectionCountOp")).toBe("ne");
    expect(result.searchParams.get("page")).toBe("3");
  });
  test.each([
    [
      1,
      "/catalog/sections?semesterId=3&teacher=%E5%BC%A0&sort=code&order=desc&search=math",
    ],
    [
      2,
      "/catalog/sections?page=2&semesterId=3&teacher=%E5%BC%A0&sort=code&order=desc&search=math",
    ],
    [
      9,
      "/catalog/sections?page=9&semesterId=3&teacher=%E5%BC%A0&sort=code&order=desc&search=math",
    ],
  ])(
    "preserves filters for first, middle, and last page (%s)",
    (page, expected) => {
      expect(
        catalogListPageHref(
          new URL(
            "https://example.test/catalog/sections?page=4&semesterId=3&teacher=%E5%BC%A0&sort=code&order=desc&search=math",
          ),
          page,
        ),
      ).toBe(expected);
    },
  );

  test("preserves section filters when changing page", () => {
    const href = catalogListPageHref(
      new URL(
        "https://example.test/catalog/sections?semesterId=3&teacher=%E5%BC%A0&sort=code&order=desc&search=math",
      ),
      2,
    );

    expect(href).toBe(
      "/catalog/sections?semesterId=3&teacher=%E5%BC%A0&sort=code&order=desc&search=math&page=2",
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
