import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
  prisma: {},
}));

import { jsonToolResult } from "@/lib/mcp/tools/_helpers";

function parseToolText(result: ReturnType<typeof jsonToolResult>) {
  const text = result.content.find(
    (item): item is { type: "text"; text: string } =>
      item.type === "text" && typeof item.text === "string",
  )?.text;

  expect(text).toBeDefined();
  return JSON.parse(text ?? "{}") as Record<string, unknown>;
}

describe("jsonToolResult summary 模式", () => {
  it("保留分页总数，同时报告返回和采样项", () => {
    const rawResult = jsonToolResult(
      {
        data: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          title: `Item ${index + 1}`,
        })),
        pagination: {
          page: 2,
          pageSize: 12,
          total: 53,
          totalPages: 5,
        },
      },
      { mode: "summary" },
    );
    const result = parseToolText(rawResult);

    expect(rawResult.structuredContent).toEqual(result);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 12,
      total: 53,
      totalPages: 5,
    });
    expect(result.data).toEqual({
      total: 53,
      returned: 12,
      remaining: 2,
      truncated: true,
      items: Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        title: `Item ${index + 1}`,
      })),
    });
  });

  it("报告非分页列表截断元数据", () => {
    const result = parseToolText(
      jsonToolResult(
        {
          homeworks: Array.from({ length: 3 }, (_, index) => ({
            id: `hw-${index + 1}`,
            title: `Homework ${index + 1}`,
          })),
        },
        { mode: "summary" },
      ),
    );

    expect(result.homeworks).toEqual({
      total: 3,
      returned: 3,
      remaining: 0,
      truncated: false,
      items: [
        { id: "hw-1", title: "Homework 1" },
        { id: "hw-2", title: "Homework 2" },
        { id: "hw-3", title: "Homework 3" },
      ],
    });
  });

  it("wraps non-object payloads in object-shaped structuredContent", () => {
    const rawResult = jsonToolResult([{ id: 1 }, { id: 2 }], {
      mode: "full",
    });
    const result = JSON.parse(rawResult.content[0]?.text ?? "null");

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(rawResult.structuredContent).toEqual({
      result: [{ id: 1 }, { id: 2 }],
    });
  });
});
