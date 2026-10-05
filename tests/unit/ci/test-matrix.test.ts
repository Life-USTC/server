import { describe, expect, it } from "vitest";
import { testMatrix } from "../../ci/test-matrix";

describe("domain / method CI matrix", () => {
  it("runs a combination once across engines and keeps other methods separate", () => {
    expect(
      testMatrix([
        {
          file: "tests/integration/a.test.ts",
          name: "tool",
          tags: ["@Homework/MCP"],
          engine: "integration",
        },
        {
          file: "b.test.ts",
          name: "worker",
          tags: ["@Homework/MCP"],
          engine: "http",
        },
        {
          file: "c.test.ts",
          name: "consumer",
          tags: ["@Homework/MCP"],
          engine: "browser",
        },
        {
          file: "d.test.ts",
          name: "form",
          tags: ["@Homework/Web"],
          engine: "browser",
        },
      ]),
    ).toEqual({
      include: [
        {
          domain: "Homework",
          method: "MCP",
          integration: true,
          integrationFiles: ["tests/integration/a.test.ts"],
          http: true,
          browser: true,
        },
        {
          domain: "Homework",
          method: "Web",
          integration: false,
          integrationFiles: [],
          http: false,
          browser: true,
        },
      ],
    });
  });

  it("deduplicates files within each combination without losing shared files", () => {
    const owners = [
      ["a", "tests/integration/a.test.ts", "@Homework/MCP"],
      ["b", "tests/integration/a.test.ts", "@Homework/MCP"],
      ["c", "tests/integration/b.test.ts", "@Homework/MCP"],
      ["d", "tests/integration/a.test.ts", "@Homework/REST"],
    ];
    expect(
      testMatrix(
        owners.map(([name, file, tag]) => ({
          name,
          file,
          tags: [tag],
          engine: "integration" as const,
        })),
      ).include.map(({ method, integrationFiles }) => ({
        method,
        integrationFiles,
      })),
    ).toEqual([
      {
        method: "MCP",
        integrationFiles: [
          "tests/integration/a.test.ts",
          "tests/integration/b.test.ts",
        ],
      },
      { method: "REST", integrationFiles: ["tests/integration/a.test.ts"] },
    ]);
  });

  it.each(
    [
      [],
      ["@Homework/Web", "@Todo/Web"],
      ["Homework/Web"],
      ["@Homework/Web.*"],
    ].map((tags) => ({ tags })),
  )("rejects missing, ambiguous or invalid ownership: $tags", ({ tags }) => {
    expect(() =>
      testMatrix([
        { file: "case.test.ts", name: "case", tags, engine: "browser" },
      ]),
    ).toThrow("case: expected exactly one");
  });

  it("creates larger groups first and breaks equal counts by name", () => {
    const tags = ["@Account/REST", "@Todo/Web", "@Course/Web", "@Course/Web"];
    expect(
      testMatrix(
        tags.map((tag, index) => ({
          name: `case ${index}`,
          file: "case.ts",
          engine: "browser" as const,
          tags: [tag],
        })),
      ).include.map(({ domain, method }) => `${domain}/${method}`),
    ).toEqual(["Course/Web", "Account/REST", "Todo/Web"]);
  });

  it("rejects spelling variants instead of creating new groups", () => {
    expect(() =>
      testMatrix([
        {
          name: "typo",
          file: "case.ts",
          engine: "browser",
          tags: ["@Todos/Rest"],
        },
      ]),
    ).toThrow("unknown test tag");
  });

  it("rejects an empty inventory", () => {
    expect(() => testMatrix([])).toThrow("No test combinations");
  });
});
