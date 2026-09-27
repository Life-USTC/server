import { describe, expect, it, vi } from "vitest";
import { mcpModeInputSchema } from "@/lib/mcp/tools/_shared/helper-schemas";
import { readSpecification } from "../../../../scripts/specifications/yaml";

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
  prisma: {},
}));

import { jsonToolResult } from "@/lib/mcp/tools/_shared/helpers";

function parseToolText(result: ReturnType<typeof jsonToolResult>) {
  const text = result.content.find(
    (item): item is { type: "text"; text: string } =>
      item.type === "text" && typeof item.text === "string",
  )?.text;

  expect(text).toBeDefined();
  return JSON.parse(text ?? "{}") as Record<string, unknown>;
}

describe("jsonToolResult canonical structured output", () => {
  it("mcp.output-mode-input", async () => {
    const spec = await readSpecification<{
      requirements: {
        id: string;
        expectation?: { values: string[]; default: string };
      }[];
    }>("docs/features/mcp.yaml");
    const expectation = spec.requirements.find(
      (rule) => rule.id === "mcp.output-mode-input",
    )?.expectation;
    if (!expectation) throw new Error("Missing MCP mode input expectation");
    expect(mcpModeInputSchema.parse(undefined)).toBe(expectation.default);
    for (const value of expectation.values)
      expect(mcpModeInputSchema.parse(value)).toBe(value);
    for (const value of ["summary", "", "DEFAULT", " full ", null, 0, {}]) {
      expect(mcpModeInputSchema.safeParse(value).success).toBe(false);
    }
  });
  it("preserves canonical pagination and collection fields in default mode", () => {
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
      { mode: "default" },
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

  it("keeps collection fields as arrays in default mode", () => {
    const result = parseToolText(
      jsonToolResult(
        {
          homeworks: Array.from({ length: 3 }, (_, index) => ({
            id: `hw-${index + 1}`,
            title: `Homework ${index + 1}`,
          })),
        },
        { mode: "default" },
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

  it("omits derived Markdown HTML in compact mode and keeps it in full mode", () => {
    const payload = {
      description: {
        content: "Source Markdown",
        renderedHtml: "<p>Source Markdown</p>",
      },
      thread: [
        {
          body: "Comment Markdown",
          renderedBody: "<p>Comment Markdown</p>",
        },
      ],
    };

    const compact = parseToolText(jsonToolResult(payload));
    const full = parseToolText(jsonToolResult(payload, { mode: "full" }));

    expect(compact.description).toEqual({ content: "Source Markdown" });
    expect(compact.thread).toEqual([{ body: "Comment Markdown" }]);
    expect(full.description).toEqual(payload.description);
    expect(full.thread).toEqual(payload.thread);
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

it("mcp.text-formatted-json", () => {
  const cases = [
    { input: { title: "Item" }, expected: { title: "Item", success: true } },
    {
      input: { success: false, error: "not_found" },
      expected: { success: false, error: "not_found" },
    },
    { input: [{ id: 1 }], expected: { success: true, result: [{ id: 1 }] } },
    { input: "plain", expected: { success: true, result: "plain" } },
    { input: 42, expected: { success: true, result: 42 } },
    { input: null, expected: { success: true, result: null } },
  ];
  for (const mode of ["default", "full"] as const) {
    for (const { input, expected } of cases) {
      const result = jsonToolResult(input, { mode });
      expect(result.structuredContent).toEqual(expected);
      expect(parseToolText(result)).toEqual(expected);
    }
  }
});
