import { describe, expect, it } from "vitest";
import { searchDemoGlobally } from "@/features/demo/server/demo-global-search";
import { getDemoCatalogLinksData } from "@/features/demo/server/demo-links";

describe("Demo global search shares the existing fictional graph", () => {
  it("matches catalog words across fields and languages without using advanced-list syntax", () => {
    for (const locale of ["en-us", "zh-cn"] as const) {
      const result = searchDemoGlobally({
        query: "  algebra DEMO-MATH01  ",
        locale,
      });
      expect(result.query).toBe("algebra DEMO-MATH01");
      expect(result.groups.map((group) => group.type)).toEqual([
        "sections",
        "courses",
      ]);
      expect(result.groups[0].items).toMatchObject([
        {
          id: "section:910001",
          code: "DEMO-MATH01.01",
          href: "/catalog/sections/910001",
        },
      ]);
      expect(result.groups[1].items).toEqual([
        {
          id: "course:920001",
          title: locale === "en-us" ? "Linear Algebra" : "线性代数",
          description: "DEMO-MATH01",
          href: "/catalog/courses/920001",
        },
      ]);
      expect(
        searchDemoGlobally({ query: "name:Algebra", locale }).groups,
      ).toEqual([]);
      expect(
        searchDemoGlobally({ query: "missing Algebra", locale }).groups,
      ).toEqual([]);
    }
  });

  it("keeps the ordinary six-distinct-term and SQL wildcard/escape rules", () => {
    const read = (query: string) =>
      searchDemoGlobally({ query, locale: "en-us", limit: 25 });
    expect(read("L Li Lin Line Linea Linear impossible")).toEqual({
      ...read("L Li Lin Line Linea Linear"),
      query: "L Li Lin Line Linea Linear impossible",
    });
    expect(read("L L Li Lin Line Linea Linear impossible").groups).toEqual(
      read("L Li Lin Line Linea Linear").groups,
    );
    expect(
      read("%_").groups.map((group) => [group.type, group.items.length]),
    ).toEqual([
      ["sections", 3],
      ["teachers", 2],
      ["courses", 3],
    ]);
    expect(read("\\%\\_").groups).toEqual([]);
  });

  it("uses real teacher routes and the existing localized names", () => {
    const result = searchDemoGlobally({
      query: "Teacher Chen",
      locale: "en-us",
    });
    expect(result.groups.map((group) => group.type)).toEqual([
      "sections",
      "teachers",
    ]);
    expect(result.groups[0].items.map((item) => item.id)).toEqual([
      "section:910001",
      "section:910002",
    ]);
    expect(result.groups[1].items).toEqual([
      {
        id: "teacher:401",
        title: "Teacher Chen",
        description: "DEMO-T01",
        href: "/catalog/teachers/401",
      },
    ]);
  });

  it("includes all six homework and three todo facts only in workspace scope", () => {
    const result = searchDemoGlobally({
      query: "%_",
      locale: "en-us",
      includeWorkspace: true,
      limit: 25,
    });
    expect(result.groups.map((group) => group.type)).toEqual([
      "sections",
      "teachers",
      "courses",
      "homeworks",
      "todos",
    ]);
    const homeworks =
      result.groups.find((group) => group.type === "homeworks")?.items ?? [];
    expect(homeworks.map((item) => item.id)).toEqual([
      "homework:demo-homework-structures",
      "homework:demo-homework-determinants",
      "homework:demo-homework-vectors",
      "homework:demo-homework-matrices",
      "homework:demo-homework-physics",
      "homework:demo-homework-project",
    ]);
    expect(homeworks[0].href).toBe(
      "/catalog/sections/910003?homeworkId=demo-homework-structures#homework",
    );
    expect(homeworks.at(-1)?.href).toBe(
      "/catalog/sections/910001?homeworkId=demo-homework-project#homework",
    );
    expect(
      result.groups.find((group) => group.type === "todos")?.items,
    ).toEqual([
      {
        id: "todo:demo-todo-reading",
        title: "Review linear algebra",
        description: "2026-09-23",
        href: "/workspace/todos",
      },
      {
        id: "todo:demo-todo-outline",
        title: "Organize course notes",
        description: "2026-09-25",
        href: "/workspace/todos",
      },
      {
        id: "todo:demo-todo-library",
        title: "Return library books",
        description: "completed",
        href: "/workspace/todos",
      },
    ]);
    expect(
      searchDemoGlobally({
        query: "chapter 3",
        locale: "en-us",
        includeWorkspace: true,
      }).groups,
    ).toEqual([{ type: "todos", items: [result.groups.at(-1)?.items[0]] }]);
    expect(
      searchDemoGlobally({
        query: "algebra",
        locale: "en-us",
        includeWorkspace: true,
      }).groups.map((group) => group.type),
    ).toEqual(["sections", "courses", "homeworks", "todos"]);
  });

  it("keeps website names and pinyin matching but returns only known internal destinations", () => {
    for (const locale of ["en-us", "zh-cn"] as const) {
      const catalog = getDemoCatalogLinksData(locale).catalogLinks;
      const found = new Set<string>();
      for (const link of catalog) {
        const group = searchDemoGlobally({
          query: link.title,
          locale,
          limit: 25,
        }).groups.find((group) => group.type === "links");
        expect(
          group?.items.some((item) => item.id === `link:${link.slug}`),
          link.slug,
        ).toBe(true);
        for (const item of group?.items ?? []) {
          const source = catalog.find((row) => item.id === `link:${row.slug}`);
          expect(source).toBeDefined();
          if (!source) throw new Error("Search returned an unknown website");
          expect(item).toMatchObject({
            title: source.title,
            description: source.description,
            external: false,
            href: `/catalog/links#link-${encodeURIComponent(source.slug)}`,
          });
          found.add(item.id);
        }
      }
      expect(found.size).toBe(65);
      expect(
        searchDemoGlobally({ query: "jiaowu", locale })
          .groups.find((group) => group.type === "links")
          ?.items.some((item) => item.id === "link:jw"),
      ).toBe(true);
    }
  });

  it("applies the per-group limit and omits short or empty matches", () => {
    expect(
      searchDemoGlobally({
        query: "%_",
        locale: "en-us",
        includeWorkspace: true,
        limit: 1,
      }).groups.map((group) => group.items.length),
    ).toEqual([1, 1, 1, 1, 1]);
    expect(
      searchDemoGlobally({
        query: "%_",
        locale: "en-us",
        includeWorkspace: true,
      }).groups.find((group) => group.type === "homeworks")?.items,
    ).toHaveLength(5);
    for (const query of ["", "  ", " a ", "不存在的搜索结果 no matching item"])
      expect(
        searchDemoGlobally({ query, locale: "zh-cn", includeWorkspace: true }),
      ).toEqual({ query: query.trim(), groups: [] });
  });
});
