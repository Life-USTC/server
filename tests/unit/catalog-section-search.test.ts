import { describe, expect, it } from "vitest";
import { buildSectionOrderBy } from "@/features/catalog/server/section-search-order";
import { parseSectionSearchQuery } from "@/features/catalog/server/section-search-parser";
import { buildSectionSearchWhere } from "@/features/catalog/server/section-search-where";

function contains(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

describe("课段搜索语法解析器", () => {
  it("识别所有标签并保留普通搜索词", () => {
    const result = parseSectionSearchQuery(
      "teacher:张三 coursecode:CS101 campus:东区 机器学习",
    );

    expect(result).toEqual({
      teacher: "张三",
      courseCode: "CS101",
      campus: "东区",
      general: "机器学习",
    });
  });

  it("识别各类别名", () => {
    const result = parseSectionSearchQuery(
      "sectioncode:A1.01 dept:CS credit:3 edulevel:本科 type:必修 sortby:code",
    );

    expect(result.lectureCode).toBe("A1.01");
    expect(result.department).toBe("CS");
    expect(result.credits).toBe("3");
    expect(result.level).toBe("本科");
    expect(result.classType).toBe("必修");
    expect(result.sort).toBe("code");
  });

  it("将 order 标签统一转换为小写", () => {
    expect(parseSectionSearchQuery("order:ASC").order).toBe("asc");
    expect(parseSectionSearchQuery("order:DESC").order).toBe("desc");
  });

  it("去除标签后裁剪普通搜索词并折叠多余空白", () => {
    const result = parseSectionSearchQuery(
      "  teacher:李四   深度学习   sort:credits  ",
    );

    expect(result.general).toBe("深度学习");
  });

  it("仅含标签时无普通搜索词", () => {
    const result = parseSectionSearchQuery("coursecode:MA201 order:asc");

    expect(result.general).toBeUndefined();
  });

  it("空字符串或纯空白返回空对象", () => {
    expect(parseSectionSearchQuery("")).toEqual({});
    expect(parseSectionSearchQuery("   ")).toEqual({});
  });

  it("忽略不符合规则的 order 值", () => {
    const result = parseSectionSearchQuery("order:random");

    expect(result.order).toBeUndefined();
  });

  it("重复标签时取第一个匹配值", () => {
    const result = parseSectionSearchQuery(
      "teacher:张三 teacher:李四 人工智能",
    );

    expect(result.teacher).toBe("张三");
    expect(result.general).toBe("人工智能");
  });

  it("保留普通搜索词中的冒号短语", () => {
    const result = parseSectionSearchQuery("name:包含冒号的内容");

    expect(result.general).toBe("name:包含冒号的内容");
  });
});

describe("课段排序构造器", () => {
  it("未提供排序字段时返回 undefined", () => {
    expect(buildSectionOrderBy(undefined)).toBeUndefined();
    expect(buildSectionOrderBy("")).toBeUndefined();
  });

  it("未知排序字段返回 undefined", () => {
    expect(buildSectionOrderBy("unknown")).toBeUndefined();
    expect(buildSectionOrderBy("  ")).toBeUndefined();
  });

  it("默认升序", () => {
    expect(buildSectionOrderBy("code")).toEqual({ code: "asc" });
  });

  it("支持显式降序", () => {
    expect(buildSectionOrderBy("credits", "desc")).toEqual({
      credits: "desc",
    });
  });

  it("字段名大小写不敏感", () => {
    expect(buildSectionOrderBy("Code", "desc")).toEqual({ code: "desc" });
    expect(buildSectionOrderBy("COURSE", "asc")).toEqual({
      course: { nameCn: "asc" },
    });
  });

  it("映射所有支持的字段与别名", () => {
    expect(buildSectionOrderBy("credits")).toEqual({ credits: "asc" });
    expect(buildSectionOrderBy("credit")).toEqual({ credits: "asc" });
    expect(buildSectionOrderBy("capacity")).toEqual({ stdCount: "asc" });
    expect(buildSectionOrderBy("semester")).toEqual({
      semester: { jwId: "asc" },
    });
    expect(buildSectionOrderBy("course")).toEqual({
      course: { nameCn: "asc" },
    });
    expect(buildSectionOrderBy("coursename")).toEqual({
      course: { nameCn: "asc" },
    });
    expect(buildSectionOrderBy("sectioncode")).toEqual({ code: "asc" });
    expect(buildSectionOrderBy("teacher")).toEqual({
      teachers: { _count: "asc" },
    });
    expect(buildSectionOrderBy("campus")).toEqual({
      campus: { nameCn: "asc" },
    });
  });
});

describe("课段搜索条件构造器", () => {
  it("空搜索返回空条件", () => {
    expect(buildSectionSearchWhere(undefined)).toEqual({});
    expect(buildSectionSearchWhere("")).toEqual({});
    expect(buildSectionSearchWhere("   ")).toEqual({});
  });

  it("将标签条件组合为 AND", () => {
    const result = buildSectionSearchWhere(
      "teacher:张三 coursecode:CS101 campus:东区",
    );

    expect(result.where).toEqual({
      AND: [
        { teachers: { some: { nameCn: contains("张三") } } },
        { course: { code: contains("CS101") } },
        { campus: { nameCn: contains("东区") } },
      ],
    });
  });

  it("lectureCode 别名映射到 section code", () => {
    const result = buildSectionSearchWhere("sectioncode:MA101.02");

    expect(result.where).toEqual({
      AND: [{ code: contains("MA101.02") }],
    });
  });

  it("credits 为有效数字时生成等值条件", () => {
    const result = buildSectionSearchWhere("credits:3.5");

    expect(result.where).toEqual({ AND: [{ credits: 3.5 }] });
  });

  it("credits 无效时忽略该条件", () => {
    const result = buildSectionSearchWhere("credits:abc");

    expect(result.where).toBeUndefined();
  });

  it("普通搜索词生成课程与课段字段的 OR 条件", () => {
    const result = buildSectionSearchWhere("机器学习");

    expect(result.where).toEqual({
      AND: [
        {
          OR: [
            { course: { nameCn: contains("机器学习") } },
            { course: { nameEn: contains("机器学习") } },
            { course: { code: contains("机器学习") } },
            { code: contains("机器学习") },
          ],
        },
      ],
    });
  });

  it("同时组合标签条件与普通 OR 条件", () => {
    const result = buildSectionSearchWhere("teacher:张三 机器学习");

    expect(result.where).toEqual({
      AND: [
        { teachers: { some: { nameCn: contains("张三") } } },
        {
          OR: [
            { course: { nameCn: contains("机器学习") } },
            { course: { nameEn: contains("机器学习") } },
            { course: { code: contains("机器学习") } },
            { code: contains("机器学习") },
          ],
        },
      ],
    });
  });

  it("排序字段为空时 orderBy 为 undefined", () => {
    const result = buildSectionSearchWhere("teacher:张三");

    expect(result.orderBy).toBeUndefined();
  });

  it("sort 标签生成对应 orderBy 并默认升序", () => {
    const result = buildSectionSearchWhere("sort:credits");

    expect(result.orderBy).toEqual({ credits: "asc" });
  });

  it("sort 与 order 标签共同生效", () => {
    const result = buildSectionSearchWhere("sort:course order:desc");

    expect(result.orderBy).toEqual({
      course: { nameCn: "desc" },
    });
  });

  it("未知 sort 字段不产生 orderBy", () => {
    const result = buildSectionSearchWhere("sort:unknown");

    expect(result.orderBy).toBeUndefined();
  });
});
