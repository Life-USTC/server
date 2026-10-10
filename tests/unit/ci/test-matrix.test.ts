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
          name: "Homework / MCP",
          slug: "homework-mcp",
          weight: 8,
          tags: "@Homework/MCP",
          grep: "@(Homework/MCP)( |$)",
          integration: true,
          integrationFiles: ["tests/integration/a.test.ts"],
          http: true,
          browser: true,
        },
        {
          name: "Homework / Web",
          slug: "homework-web",
          weight: 4,
          tags: "@Homework/Web",
          grep: "@(Homework/Web)( |$)",
          integration: false,
          integrationFiles: [],
          http: false,
          browser: true,
        },
      ],
    });
  });

  it("packs light combinations together and leaves a heavy one alone", () => {
    // One combination far heavier than an even share keeps its own job; the
    // rest are collected so the run does not pay a job's fixed cost per tag.
    const owners = [
      ...Array.from({ length: 40 }, (_, index) => ({
        name: `heavy ${index}`,
        file: "heavy.ts",
        engine: "browser" as const,
        tags: ["@Account/Web"],
      })),
      ...["@Todo/Service", "@Exam/Service", "@Bus/Service"].map((tag) => ({
        name: `light ${tag}`,
        file: `${tag.slice(1).replace("/", "-")}.test.ts`,
        engine: "integration" as const,
        tags: [tag],
      })),
    ];
    const jobs = testMatrix(owners).include;
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      name: "Account / Web",
      tags: "@Account/Web",
      browser: true,
      integration: false,
    });
    // Every light combination still runs, through one filter and one job.
    expect(jobs[1]).toMatchObject({
      name: "Bus / Service +2",
      slug: "bus-service",
      tags: "@Bus/Service || @Exam/Service || @Todo/Service",
      grep: "@(Bus/Service|Exam/Service|Todo/Service)( |$)",
      integration: true,
      browser: false,
    });
    expect(jobs[1].integrationFiles).toHaveLength(3);
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
      ).include.map(({ name, integrationFiles }) => ({
        name,
        integrationFiles,
      })),
    ).toEqual([
      {
        name: "Homework / MCP",
        integrationFiles: [
          "tests/integration/a.test.ts",
          "tests/integration/b.test.ts",
        ],
      },
      {
        name: "Homework / REST",
        integrationFiles: ["tests/integration/a.test.ts"],
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

  it("places heavier combinations first and breaks equal weights by name", () => {
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
    ).toEqual(["Course / Web", "Account / REST", "Todo / Web"]);
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
