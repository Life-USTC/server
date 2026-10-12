import { describe, expect, it } from "vitest";
import { testMatrix } from "../../ci/test-matrix";

const owner = (
  tag: string,
  engine: "integration" | "http" | "browser",
  file = "case.ts",
) => ({
  name: `${tag} ${engine} ${file}`,
  file,
  tags: [tag],
  engine,
});

describe("feature CI matrix", () => {
  it("collects a feature's methods and files into one job", () => {
    expect(
      testMatrix([
        owner("@Homework/MCP", "integration", "tests/integration/a.test.ts"),
        owner("@Homework/MCP", "integration", "tests/integration/a.test.ts"),
        owner("@Homework/REST", "integration", "tests/integration/b.test.ts"),
        owner("@Homework/MCP", "http"),
        owner("@Homework/Web", "browser"),
      ]),
    ).toEqual({
      include: [
        {
          name: "Homework",
          slug: "homework",
          tags: "@Homework/MCP || @Homework/REST || @Homework/Web",
          grep: "@Homework/",
          integration: true,
          integrationFiles: [
            "tests/integration/a.test.ts",
            "tests/integration/b.test.ts",
          ],
          http: true,
          browser: true,
        },
      ],
    });
  });

  it("gives every feature its own job, longest first, then by name", () => {
    const jobs = testMatrix([
      owner("@Course/Web", "browser"),
      owner("@Course/Web", "browser"),
      owner("@Account/REST", "browser"),
      owner("@Todo/Web", "browser"),
      owner("@Bus/Service", "integration", "tests/integration/bus.test.ts"),
    ]).include;
    expect(jobs.map((job) => job.name)).toEqual([
      "Course",
      "Account",
      "Todo",
      "Bus",
    ]);
    // Nothing is dropped and nothing runs twice.
    expect(jobs.flatMap((job) => job.tags.split(" || ")).toSorted()).toEqual([
      "@Account/REST",
      "@Bus/Service",
      "@Course/Web",
      "@Todo/Web",
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

  it("rejects spelling variants instead of creating new groups", () => {
    expect(() => testMatrix([owner("@Todos/Rest", "browser")])).toThrow(
      "unknown test tag",
    );
  });

  it("rejects an empty inventory", () => {
    expect(() => testMatrix([])).toThrow("No test combinations");
  });
});
