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

describe("jsonToolResult canonical structured output", () => {
  it("treats summary as a shape-compatible alias for default", () => {
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
    expect(result.success).toBe(true);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 12,
      total: 53,
      totalPages: 5,
    });
    expect(result.data).toEqual(
      Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        title: `Item ${index + 1}`,
      })),
    );
  });

  it("keeps collection fields as arrays in summary compatibility mode", () => {
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

    expect(result).toEqual({
      success: true,
      homeworks: [
        { id: "hw-1", title: "Homework 1" },
        { id: "hw-2", title: "Homework 2" },
        { id: "hw-3", title: "Homework 3" },
      ],
    });
  });

  it("keeps canonical field names while full only adds fields", () => {
    const payload = {
      course: {
        id: 1,
        jwId: 1001,
        code: "CS1001",
        nameCn: "计算机导论",
        nameEn: "Introduction to Computing",
        namePrimary: "计算机导论",
        nameSecondary: "Introduction to Computing",
        credit: 3,
        hours: 48,
        internalAuditValue: "full-only",
      },
    };

    const compact = parseToolText(jsonToolResult(payload));
    const full = parseToolText(jsonToolResult(payload, { mode: "full" }));

    expect(compact.course).toMatchObject({
      nameCn: "计算机导论",
      nameEn: "Introduction to Computing",
    });
    expect(compact.course).not.toHaveProperty("nc");
    expect(compact.course).not.toHaveProperty("internalAuditValue");
    expect(full.course).toMatchObject({
      nameCn: "计算机导论",
      internalAuditValue: "full-only",
    });
  });

  it("wraps non-object payloads in object-shaped structuredContent", () => {
    const rawResult = jsonToolResult([{ id: 1 }, { id: 2 }], {
      mode: "full",
    });
    const result = JSON.parse(rawResult.content[0]?.text ?? "null");

    expect(result).toEqual({
      success: true,
      result: [{ id: 1 }, { id: 2 }],
    });
    expect(rawResult.structuredContent).toEqual(result);
  });

  it("canonicalizes non-JSON values before exposing both content forms", () => {
    const rawResult = jsonToolResult(
      {
        omitted: undefined,
        nested: { omitted: undefined, finite: 1, nonFinite: Number.NaN },
      },
      { mode: "full" },
    );
    const result = parseToolText(rawResult);

    expect(rawResult.structuredContent).toEqual(result);
    expect(result).toEqual({
      success: true,
      nested: { finite: 1, nonFinite: null },
    });
  });
});
