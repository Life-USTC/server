import { describe, expect, it } from "vitest";
import * as z from "zod";
import {
  getRequestSearchParams,
  jsonResponse,
  parseInteger,
  parseIntegerList,
  parseRouteInput,
  parseRouteQuery,
  parseRouteSearchParams,
} from "@/lib/api/helpers";

describe("API 辅助函数", () => {
  it("不覆盖代理提供的请求 ID 标头", () => {
    const response = jsonResponse({ ok: true });

    expect(response.headers.has("x-request-id")).toBe(false);
  });

  it("接受来自字符串和数字的安全整数", () => {
    expect(parseInteger("42")).toBe(42);
    expect(parseInteger("  -7 ")).toBe(-7);
    expect(parseInteger(9)).toBe(9);
  });

  it("拒绝部分和无效的数字格式", () => {
    expect(parseInteger("12abc")).toBeNull();
    expect(parseInteger("3.14")).toBeNull();
    expect(parseInteger(3.14)).toBeNull();
    expect(parseInteger("")).toBeNull();
    expect(parseInteger(" ")).toBeNull();
    expect(parseInteger(undefined)).toBeNull();
  });

  it("解析整数列表并丢弃无效项", () => {
    expect(parseIntegerList("1,2,foo, 3")).toEqual([1, 2, 3]);
    expect(parseIntegerList(" ")).toEqual([]);
    expect(parseIntegerList(null)).toEqual([]);
  });

  it("从 Request 读取搜索参数", () => {
    const request = new Request("https://example.test/path?page=2");

    expect(getRequestSearchParams(request).get("page")).toBe("2");
  });

  it("使用 Zod 模式解析路由输入", () => {
    const result = parseRouteInput(
      { page: "2" },
      z.object({ page: z.string() }),
      "Invalid query",
    );

    expect(result).toEqual({ page: "2" });
  });

  it("为无效路由输入返回响应", async () => {
    const result = parseRouteInput(
      { page: 2 },
      z.object({ page: z.string() }),
      "Invalid query",
    );

    expect(result).toBeInstanceOf(Response);
    expect(await (result as Response).json()).toEqual({
      error: "Invalid query",
    });
  });

  it("优先使用规范的 pageSize 查询参数", () => {
    const result = parseRouteQuery(
      new URLSearchParams("search=math&page=3&pageSize=25&limit=80"),
      z.object({
        search: z.string().optional(),
        page: z.string().optional(),
        pageSize: z.string().optional(),
        limit: z.string().optional(),
      }),
      "Invalid query",
      { pagination: { maxPageSize: 100 } },
    );

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({
      query: {
        search: "math",
        page: "3",
        pageSize: "25",
        limit: "80",
      },
      pagination: { page: 3, pageSize: 25, skip: 50 },
    });
  });

  it("在 pageSize 缺失时接受废弃的 limit 别名", () => {
    const result = parseRouteQuery(
      new URLSearchParams("page=3&limit=250"),
      z.object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        limit: z.string().optional(),
      }),
      "Invalid query",
      { pagination: { maxPageSize: 100 } },
    );

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({
      query: { page: "3", pageSize: undefined, limit: "250" },
      pagination: { page: 3, pageSize: 100, skip: 200 },
    });
  });

  it("解析不带分页的路由搜索参数", () => {
    const result = parseRouteSearchParams(
      new URLSearchParams("versionKey=current&unused=value"),
      z.object({ versionKey: z.string().optional() }),
      "Invalid query",
    );

    expect(result).toEqual({ versionKey: "current" });
  });
});
