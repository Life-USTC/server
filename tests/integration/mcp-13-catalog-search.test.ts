import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("学期查询工具", () => {
  it("list_semesters 返回与 REST 等价的分页学期列表", async () => {
    const result = await context.client.call<{
      data?: Array<{
        id?: number;
        jwId?: number;
        code?: string;
        nameCn?: string;
        startDate?: string;
        endDate?: string;
      }>;
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    }>("list_semesters", {
      page: 1,
      limit: 20,
      mode: "default",
    });

    expect(result.pagination?.page).toBe(1);
    expect(result.pagination?.pageSize).toBe(20);
    expect((result.pagination?.total ?? 0) > 0).toBe(true);
    expect((result.pagination?.totalPages ?? 0) >= 1).toBe(true);

    const semester = result.data?.find(
      (item) => item.jwId === fixtures.DEV_SEED.semesterJwId,
    );
    expect(semester).toBeDefined();
    expect(semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
    expect(typeof semester?.id).toBe("number");
    expect(typeof semester?.code).toBe("string");
    expect(typeof semester?.startDate).toBe("string");
    expect(typeof semester?.endDate).toBe("string");
  });

  it("list_semesters summary 模式折叠列表为统计摘要", async () => {
    const result = await context.client.call<{
      data?: {
        total?: number;
        returned?: number;
        truncated?: boolean;
        items?: Array<{
          jwId?: number;
          nameCn?: string;
        }>;
      };
    }>("list_semesters", {
      page: 1,
      limit: 10,
      mode: "summary",
    });

    expect(typeof result.data?.total).toBe("number");
    expect(typeof result.data?.returned).toBe("number");
    expect(typeof result.data?.truncated).toBe("boolean");
    expect(Array.isArray(result.data?.items)).toBe(true);

    const semester = result.data?.items?.find(
      (item) => item.jwId === fixtures.DEV_SEED.semesterJwId,
    );
    expect(semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
  });

  it("list_semesters 越界页码返回空数据与正确分页元数据", async () => {
    const result = await context.client.call<{
      data?: unknown[];
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    }>("list_semesters", {
      page: 9999,
      limit: 10,
      mode: "default",
    });

    expect(result.data).toHaveLength(0);
    expect(result.pagination?.page).toBe(9999);
    expect(result.pagination?.pageSize).toBe(10);
    expect((result.pagination?.total ?? 0) > 0).toBe(true);
    expect(result.pagination?.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("list_semesters 拒绝越界或无效分页参数", async () => {
    await expect(
      context.client.call("list_semesters", { page: 0, limit: 10 }),
    ).rejects.toThrow();

    await expect(
      context.client.call("list_semesters", { page: 1, limit: 101 }),
    ).rejects.toThrow();

    await expect(
      context.client.call("list_semesters", {
        page: "not-a-number",
        limit: 10,
      }),
    ).rejects.toThrow();
  });

  it("get_current_semester 返回覆盖当前的 seed 学期", async () => {
    const result = await context.client.call<{
      found?: boolean;
      semester?: {
        id?: number;
        jwId?: number;
        code?: string;
        nameCn?: string;
        startDate?: string;
        endDate?: string;
      };
    }>("get_current_semester", { mode: "default" });

    expect(result.found).toBe(true);
    expect(result.semester?.jwId).toBe(fixtures.DEV_SEED.semesterJwId);
    expect(result.semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
    expect(typeof result.semester?.id).toBe("number");
    expect(typeof result.semester?.code).toBe("string");
    expect(typeof result.semester?.startDate).toBe("string");
    expect(typeof result.semester?.endDate).toBe("string");
  });

  it("get_current_semester full 模式返回完整学期记录", async () => {
    const result = await context.client.call<{
      found?: boolean;
      semester?: Record<string, unknown>;
    }>("get_current_semester", { mode: "full" });

    expect(result.found).toBe(true);
    expect(result.semester?.jwId).toBe(fixtures.DEV_SEED.semesterJwId);
    expect(result.semester).toHaveProperty("id");
    expect(result.semester).toHaveProperty("nameCn");
    expect(result.semester).toHaveProperty("startDate");
    expect(result.semester).toHaveProperty("endDate");
  });

  it("get_current_semester 拒绝无效 mode 参数", async () => {
    await expect(
      context.client.call("get_current_semester", { mode: "invalid-mode" }),
    ).rejects.toThrow();
  });
});
