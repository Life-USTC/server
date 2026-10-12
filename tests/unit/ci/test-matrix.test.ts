import { describe, expect, it } from "vitest";
import { testMatrix } from "../../ci/test-matrix";

describe("feature CI matrix", () => {
  it("runs a feature's methods in one job across engines", () => {
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
          name: "Homework",
          slug: "homework",
          tags: "@Homework/MCP || @Homework/Web",
          grep: "@Homework/",
          integration: true,
          integrationFiles: ["tests/integration/a.test.ts"],
          http: true,
          browser: true,
        },
      ],
    });
  });

  it("gives each feature its own job and names it after the feature", () => {
    const jobs = testMatrix([
      {
        name: "page",
        file: "page.ts",
        engine: "browser",
        tags: ["@Account/Web"],
      },
      {
        name: "service",
        file: "tests/integration/todo.test.ts",
        engine: "integration",
        tags: ["@Todo/Service"],
      },
    ]).include;
    expect(jobs.map((job) => job.name)).toEqual(["Account", "Todo"]);
    expect(jobs[1]).toMatchObject({
      slug: "todo",
      tags: "@Todo/Service",
      grep: "@Todo/",
      integration: true,
      browser: false,
    });
  });

  it("keeps every collected combination in exactly one job", () => {
    const tags = [
      "@Account/Web",
      "@Todo/Service",
      "@Exam/REST",
      "@Bus/MCP",
      "@Course/GraphQL",
    ];
    const jobs = testMatrix(
      tags.flatMap((tag, index) =>
        Array.from({ length: index + 1 }, (_, n) => ({
          name: `${tag} ${n}`,
          file: "case.ts",
          engine: "browser" as const,
          tags: [tag],
        })),
      ),
    ).include;
    const placed = jobs.flatMap((job) => job.tags.split(" || "));
    expect(placed.toSorted()).toEqual(tags.toSorted());
  });

  it("deduplicates files within each feature without losing shared files", () => {
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
      ).include.map(({ name, integrationFiles }) => ({
        name,
        integrationFiles,
      })),
    ).toEqual([
      {
        name: "Homework",
        integrationFiles: [
          "tests/integration/a.test.ts",
          "tests/integration/b.test.ts",
        ],
      },
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

  it("lists the longest feature first and breaks equal weights by name", () => {
    const tags = ["@Account/REST", "@Todo/Web", "@Course/Web", "@Course/Web"];
    expect(
      testMatrix(
        tags.map((tag, index) => ({
          name: `case ${index}`,
          file: "case.ts",
          engine: "browser" as const,
          tags: [tag],
        })),
      ).include.map(({ name }) => name),
    ).toEqual(["Course", "Account", "Todo"]);
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
