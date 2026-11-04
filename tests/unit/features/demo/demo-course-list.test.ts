import { describe, expect, it } from "vitest";
import { getDemoCatalogCourse } from "@/features/demo/server/demo-catalog";
import {
  getDemoCourseList,
  getDemoCourseListPage,
} from "@/features/demo/server/demo-course-list";
import { getDemoCourseListRoute } from "@/lib/api/routes/demo-course-list-route";
import { paginatedCourseResponseSchema } from "@/lib/api/schemas/response-schemas";

const page = (query = "", locale: "en-us" | "zh-cn" = "en-us") =>
  getDemoCourseListPage(
    new URL(`https://demo.test/catalog/courses?${query}`),
    locale,
  );
const api = (query = "", locale: "en-us" | "zh-cn" = "en-us") =>
  getDemoCourseListRoute(
    new Request(`https://demo.test/api/catalog/courses?${query}`),
    locale,
  );

describe("demo course collection", () => {
  it.each(["zh-cn", "en-us"] as const)(
    "shares identities, order and locale with details and REST in %s",
    async (locale) => {
      const result = await page("", locale);
      const rest = paginatedCourseResponseSchema.parse(
        await api("", locale).json(),
      );
      expect(rest.data).toEqual(result.data);
      expect(rest.pagination).toEqual(result.pagination);
      expect(result.data.map((course) => course.jwId)).toEqual([
        920003, 920001, 920002,
      ]);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 3,
        totalPages: 1,
      });
      expect(result.filterOptions).toEqual({
        categories: [],
        classTypes: [],
        educationLevels: [],
      });
      for (const course of result.data)
        expect(getDemoCatalogCourse(course.jwId, locale)).toMatchObject(course);
      expect(result.data[1].namePrimary).toBe(
        locale === "en-us" ? "Linear Algebra" : "线性代数",
      );
    },
  );

  it.each([
    ["linear algebra", [920001]],
    ["数据", [920003]],
    ["demo-phys", [920002]],
    ["linear%algebra", [920001]],
    ["DEMO-MATH0_", [920001]],
    ["DEMO-MATH0\\_", []],
    ["no matching course", []],
    [`${"%a".repeat(98)}x`, []],
    [`${"%".repeat(198)}Z`, []],
    [`${"%_".repeat(10)}Z`, []],
  ] as const)(
    "keeps Web and API text matching aligned for %s",
    async (search, expected) => {
      const query = new URLSearchParams({ search }).toString();
      const result = await page(query);
      expect(result.data.map((course) => course.jwId)).toEqual(expected);
      expect((await api(query).json()).data).toEqual(result.data);
    },
  );

  it("ANDs Web column filters and normalizes drafts using existing Web rules", async () => {
    const filtered = await page("name=Linear&code=PHYS");
    expect(filtered.data).toEqual([]);
    const matching = await page("name=Linear&code=MATH&search=Algebra");
    expect(matching.data.map((course) => course.jwId)).toEqual([920001]);
    expect(
      (await page("page=-1&search=x&name=%20Linear%20&ignored=real")).filters,
    ).toEqual({ name: "Linear" });
    for (const key of ["categoryId", "classTypeId", "educationLevelId"]) {
      expect((await page(`${key}=201,999999`)).data).toEqual([]);
      expect((await api(`${key}=999999`).json()).data).toEqual([]);
    }
  });

  it("paginates the fixed set without duplication, resets or data mutation", async () => {
    const first = await api("pageSize=2").json();
    const second = await api("page=2&pageSize=2").json();
    const beyond = await api("page=3&pageSize=2").json();
    expect(first.data.map((c: { jwId: number }) => c.jwId)).toEqual([
      920003, 920001,
    ]);
    expect(second.data.map((c: { jwId: number }) => c.jwId)).toEqual([920002]);
    expect(second.pagination).toEqual({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(beyond.data).toEqual([]);
    expect(beyond.pagination).toEqual({
      page: 3,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect((await page("page=2")).data).toEqual([]);
    expect((await page("page=100001")).pagination.page).toBe(100000);
    const mutable = getDemoCourseList("en-us", {}, { page: 1, pageSize: 20 });
    mutable.data[0].namePrimary = "changed";
    expect((await page()).data[0].namePrimary).toBe("Data Structures");
  });

  it("retains REST validation and rejects unknown or mixed identifier inputs", async () => {
    for (const query of [
      "page=0",
      "page=101",
      "pageSize=101",
      "search=x",
      "locale=fr",
      "categoryId=1,2",
      "ids=201,999999",
      "jwIds=920001,999999",
      "userId=victim",
      "name=Linear",
    ]) {
      expect(api(query).status, query).toBe(400);
    }
    expect(
      (await api("locale=zh-cn", "en-us").json()).data[0].namePrimary,
    ).toBe("数据结构");
  });
});
