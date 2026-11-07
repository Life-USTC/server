import { describe, expect, it } from "vitest";
import { getDemoCatalogTeacher } from "@/features/demo/server/demo-catalog";
import { getDemoTeacherListPage } from "@/features/demo/server/demo-teacher-list";
import { getDemoTeacherListRoute } from "@/lib/api/routes/demo-teacher-list-route";
import { paginatedTeacherResponseSchema } from "@/lib/api/schemas/response-schemas";

const page = (query = "", locale: "en-us" | "zh-cn" = "en-us") =>
  getDemoTeacherListPage(
    new URL(`https://demo.test/catalog/teachers?${query}`),
    locale,
  );
const api = (query = "", locale: "en-us" | "zh-cn" = "en-us") =>
  getDemoTeacherListRoute(
    new Request(`https://demo.test/api/catalog/teachers?${query}`),
    locale,
  );

describe("demo teacher collection", () => {
  it.each(["zh-cn", "en-us"] as const)(
    "shares identities, counts, null metadata, order and locale with details and REST in %s",
    async (locale) => {
      const result = await page("", locale);
      const rest = paginatedTeacherResponseSchema.parse(
        await api("", locale).json(),
      );
      expect(rest.data).toEqual(result.data);
      expect(rest.pagination).toEqual(result.pagination);
      expect(result.data.map((item) => item.id)).toEqual([402, 401]);
      expect(result.data.map((item) => item._count.sections)).toEqual([2, 2]);
      expect(result.filterOptions).toEqual({
        departments: [],
        teacherTitles: [],
      });
      for (const teacher of result.data) {
        expect(getDemoCatalogTeacher(teacher.id, locale)).toMatchObject({
          id: teacher.id,
          namePrimary: teacher.namePrimary,
          _count: teacher._count,
        });
        expect(teacher.departmentId).toBeNull();
        expect(teacher.email).toBeNull();
      }
      expect(result.data[0].namePrimary).toBe(
        locale === "en-us" ? "Teacher Lin" : "林老师",
      );
    },
  );
  it.each([
    ["teacher chen", [401]],
    ["林老师", [402]],
    ["DEMO-T0_", [402, 401]],
    ["DEMO-T0\\_", []],
    ["teacher%chen", [401]],
    ["LIVE-ONLY", []],
    [`${"%_".repeat(10)}Z`, []],
  ] as const)(
    "keeps Web and REST text matching aligned for %s",
    async (search, ids) => {
      const query = new URLSearchParams({ search }).toString();
      const result = await page(query);
      expect(result.data.map((item) => item.id)).toEqual(ids);
      expect((await api(query).json()).data).toEqual(result.data);
    },
  );
  it("uses normalized AND column filters, numeric operators and unknown metadata without live lookups", async () => {
    expect((await page("name=Chen&code=T02")).data).toEqual([]);
    expect(
      (await page("name=Chen&code=T01")).data.map((item) => item.id),
    ).toEqual([401]);
    for (const query of [
      "email=example",
      "departmentId=999999",
      "teacherTitleId=999999",
      "departmentId=1,2",
    ])
      expect((await page(query)).data, query).toEqual([]);
    for (const [op, expected] of [
      ["eq", 2],
      ["ne", 0],
      ["gt", 0],
      ["gte", 2],
      ["lt", 0],
      ["lte", 2],
      ["between", 2],
    ] as const)
      expect(
        (await page(`sectionCount=2&sectionCountOp=${op}&sectionCountMax=3`))
          .data.length,
        op,
      ).toBe(expected);
    expect(
      (await page("page=-1&name=%20Chen%20&search=x&userId=victim")).filters,
    ).toEqual({ name: "Chen" });
    expect((await page("page=2")).data).toEqual([]);
  });
  it("paginates the same finite teachers and validates the existing REST schema", async () => {
    expect(
      (await api("pageSize=1").json()).data.map(
        (item: { id: number }) => item.id,
      ),
    ).toEqual([402]);
    expect(
      (await api("pageSize=1&page=2").json()).data.map(
        (item: { id: number }) => item.id,
      ),
    ).toEqual([401]);
    expect((await api("pageSize=1&page=3").json()).data).toEqual([]);
    for (const query of [
      "page=0",
      "page=101",
      "pageSize=101",
      "search=x",
      "locale=fr",
      "departmentId=1,2",
      "ids=401,999999",
      "jwIds=930001,999999",
      "userId=victim",
      "name=Chen",
      "teacherTitleId=1",
    ])
      expect(api(query).status, query).toBe(400);
    expect((await api("departmentId=999999").json()).data).toEqual([]);
    expect((await api("locale=zh-cn").json()).data[0].namePrimary).toBe(
      "林老师",
    );
  });
});
