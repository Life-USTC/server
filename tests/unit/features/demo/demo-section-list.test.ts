import { describe, expect, it } from "vitest";
import { getDemoCatalogSection } from "@/features/demo/server/demo-catalog";
import { getDemoSectionListPage } from "@/features/demo/server/demo-section-list";
import { getDemoSectionListRoute } from "@/lib/api/routes/demo-section-list-route";
import { paginatedSectionResponseSchema } from "@/lib/api/schemas/response-schemas";

const page = (query = "", locale: "en-us" | "zh-cn" = "en-us") =>
  getDemoSectionListPage(
    new URL(`https://demo.test/catalog/sections?${query}`),
    locale,
  );
const api = (query = "", locale: "en-us" | "zh-cn" = "en-us") =>
  getDemoSectionListRoute(
    new Request(`https://demo.test/api/catalog/sections?${query}`),
    locale,
  );
const ids = (data: { jwId: number }[]) => data.map((row) => row.jwId);

describe("demo section collection", () => {
  it.each(["zh-cn", "en-us"] as const)(
    "shares localized identities, relations and summaries in %s",
    async (locale) => {
      const result = await page("", locale);
      const rest = paginatedSectionResponseSchema.parse(
        await api("", locale).json(),
      );
      expect(rest.data).toEqual(result.data);
      expect(ids(rest.data)).toEqual([910001, 910002, 910003]);
      expect(rest.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 3,
        totalPages: 1,
      });
      expect(result.filterOptions.semesters.map((s) => s.id)).toEqual([
        2609, 2602,
      ]);
      expect(result.filterOptions).toMatchObject({
        campuses: [],
        departments: [],
        categories: [],
        classTypes: [],
        educationLevels: [],
      });
      expect(result.data[0].course.namePrimary).toBe(
        locale === "en-us" ? "Linear Algebra" : "线性代数",
      );
      for (const row of result.data) {
        expect(getDemoCatalogSection(row.jwId, locale)).toMatchObject(row);
        expect(row).not.toHaveProperty("kind");
        expect(row.stdCount).toBeNull();
        expect(row.limitCount).toBeNull();
      }
    },
  );

  it.each([
    ["algebra Chen", [910001]],
    ["teacher:Lin", [910001, 910003]],
    ['teacher:"Teacher Chen" credits:3', [910002]],
    ["coursecode:DEMO-CS", [910003]],
    ["sectioncode:PHYS01.01", [910002]],
    ["semester:秋季", [910001, 910002]],
    ["credit:3.5", [910003]],
    ["credits:invalid", [910001, 910002, 910003]],
    ["campus:East", []],
    ["dept:Math", []],
    ["category:Basic", []],
    ["level:Undergraduate", []],
    ["type:Required", []],
    ["sort:credits order:desc", [910001, 910003, 910002]],
    ["sort:teacher", [910002, 910003, 910001]],
    ["sort:course", [910002, 910003, 910001]],
    ["sort:code", [910003, 910001, 910002]],
    ["sort:semester", [910003, 910001, 910002]],
    ["sort:capacity order:desc", [910001, 910002, 910003]],
    ["sort:campus", [910001, 910002, 910003]],
    ["sort:unknown", [910001, 910002, 910003]],
    ["DEMO-MATH0_", [910001]],
    ["DEMO-MATH0\\_", []],
    [`${"%_".repeat(10)}Z`, []],
    [`${"%".repeat(198)}Z`, []],
    ["missing", []],
  ] as const)(
    "retains shared search semantics: %s",
    async (search, expected) => {
      const query = new URLSearchParams({ search }).toString();
      const web = await page(query);
      expect(ids(web.data)).toEqual(expected);
      expect((await api(query).json()).data).toEqual(web.data);
    },
  );

  it.each([
    ["credits=3.5", [910003]],
    ["credits=3&creditsOp=ne", [910001, 910003]],
    ["credits=3.5&creditsOp=gt", [910001]],
    ["credits=3.5&creditsOp=gte", [910001, 910003]],
    ["credits=3.5&creditsOp=lt", [910002]],
    ["credits=3.5&creditsOp=lte", [910002, 910003]],
    ["credits=3&creditsOp=between&creditsMax=3.5", [910002, 910003]],
    ["teacherCount=1&teacherCountOp=gt", [910001]],
    ["stdCount=0&stdCountOp=ne", []],
    ["stdCount=0", []],
    ["limitCount=0&limitCountOp=lte", []],
    ["semesterId=2602,2609&teacher=Lin", [910001, 910003]],
    ["semesterId=2602,999999", [910003]],
    ["semesterId=999999", []],
    ["categoryId=201,999999", []],
    ["courseName=Linear&sectionCode=PHYS", []],
    ["search=teacher%3AChen%20credits%3A3&teacher=Lin&credits=4", [910001]],
    [
      "search=sort%3Acredits%20order%3Adesc&sort=code&order=asc",
      [910003, 910001, 910002],
    ],
  ] as const)(
    "preserves Web comparisons, nulls and explicit precedence: %s",
    async (query, expected) => {
      expect(ids((await page(query)).data)).toEqual(expected);
    },
  );

  it.each([
    ["courseId=201", [910001]],
    ["courseJwId=920002", [910002]],
    ["semesterJwId=2602", [910003]],
    ["teacherId=402", [910001, 910003]],
    ["teacherCode=DEMO-T01", [910001, 910002]],
    ["teacherId=401&teacherCode=DEMO-T02", []],
    ["ids=101,103", [910001, 910003]],
    ["jwIds=910002,910003", [910002, 910003]],
    ["ids=101&jwIds=910002", []],
    ["courseId=201&courseJwId=920002", []],
    ["teacherId=999999", []],
    ["campusId=1", []],
    ["departmentId=1", []],
  ] as const)(
    "keeps REST relation constraints conjunctive: %s",
    async (query, expected) => {
      const response = api(query);
      expect(response.status).toBe(200);
      expect(ids((await response.json()).data)).toEqual(expected);
    },
  );

  it("paginates without mutation and keeps transport validation boundaries", async () => {
    const first = await api("pageSize=2").json();
    const second = await api("pageSize=2&page=2").json();
    expect(ids(first.data)).toEqual([910001, 910002]);
    expect(ids(second.data)).toEqual([910003]);
    expect(second.pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect((await api("pageSize=2&page=3").json()).data).toEqual([]);
    expect((await page("page=2")).data).toEqual([]);
    expect((await page("page=999999")).pagination.page).toBe(100000);
    first.data[0].teachers[0].namePrimary = "changed";
    expect((await page()).data[0].teachers[0].namePrimary).toBe("Teacher Chen");
    for (const query of ["ids=101,999999", "jwIds=910001,999999"])
      expect(api(query).status).toBe(404);
    for (const query of [
      "ids=",
      "ids=101,bad",
      "ids=0",
      "ids=2147483648",
      `ids=${Array(101).fill(101).join(",")}`,
      "ids=101&ids=103",
      "page=101",
      "pageSize=0",
      "search=x",
      "locale=fr",
      "semesterId=2602,2609",
      "userId=victim",
      "teacherCount=2",
    ])
      expect(api(query).status, query).toBe(400);
    expect((await api("locale=zh-cn").json()).data[0].course.namePrimary).toBe(
      "线性代数",
    );
  });
});
