import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { JSONReport, JSONReportSuite } from "@playwright/test/reporter";
import { testTags } from "./test-tags";

type Engine = "integration" | "http" | "browser";
export type TestOwner = {
  name: string;
  file: string;
  tags: readonly string[];
  engine: Engine;
};

// Tags declare ownership in the tests. This only deduplicates combinations;
// native runners retain responsibility for discovery and execution.
export function testMatrix(tests: TestOwner[]) {
  const knownTags = new Set(testTags.map((tag) => tag.name));
  const caseCounts = new Map<string, number>();
  const groups = new Map<
    string,
    {
      domain: string;
      method: string;
      integration: boolean;
      integrationFiles: string[];
      http: boolean;
      browser: boolean;
    }
  >();
  for (const test of tests) {
    if (
      test.tags.length !== 1 ||
      !/^@[A-Z][A-Za-z]+\/[A-Z][A-Za-z]+$/.test(test.tags[0])
    ) {
      throw new Error(`${test.name}: expected exactly one @Domain/Method tag`);
    }
    const tag = test.tags[0];
    if (!knownTags.has(tag))
      throw new Error(`${test.name}: unknown test tag ${tag}`);
    const [domain, method] = tag.slice(1).split("/");
    const group = groups.get(tag) ?? {
      domain,
      method,
      integration: false,
      integrationFiles: [] as string[],
      http: false,
      browser: false,
    };
    group[test.engine] = true;
    if (test.engine === "integration") {
      if (!test.file) throw new Error(`${test.name}: missing integration file`);
      if (!group.integrationFiles.includes(test.file))
        group.integrationFiles.push(test.file);
    }
    groups.set(tag, group);
    caseCounts.set(tag, (caseCounts.get(tag) ?? 0) + 1);
  }
  if (!groups.size) throw new Error("No test combinations collected");
  if (groups.size > 256)
    throw new Error("Test combinations exceed the CI matrix limit");
  return {
    include: [...groups.entries()]
      // Create larger native groups first to reduce time waiting at the tail.
      .sort(
        ([a], [b]) =>
          (caseCounts.get(b) ?? 0) - (caseCounts.get(a) ?? 0) ||
          a.localeCompare(b),
      )
      .map(([, group]) => group),
  };
}

if (import.meta.main) {
  const tests: TestOwner[] = [];
  const { createVitest } = await import("vitest/node");
  const vitest = await createVitest({
    config: "vitest.integration.config.ts",
    watch: false,
    // Collection executes declarations only; test execution stays serial per job.
    fileParallelism: true,
    maxWorkers: 2,
  });
  try {
    const { testModules, unhandledErrors } = await vitest.collect(undefined, {
      staticParse: false,
    });
    if (unhandledErrors.length)
      throw new AggregateError(
        unhandledErrors,
        "Integration collection failed",
      );
    for (const module of testModules) {
      for (const suite of [module, ...module.children.allSuites()]) {
        if (suite.errors().length)
          throw new AggregateError(
            suite.errors(),
            "Integration collection failed",
          );
      }
      for (const test of module.children.allTests()) {
        if (test.options.mode === "skip" || test.options.mode === "todo")
          continue;
        tests.push({
          name: `${module.moduleId}: ${test.fullName}`,
          file: relative(process.cwd(), module.moduleId),
          tags: test.options.tags ?? [],
          engine: "integration",
        });
      }
    }
  } finally {
    await vitest.close();
  }
  for (const [engine, args] of [
    ["http", ["--config=playwright.api.config.ts"]],
    ["browser", ["--project=chromium", "--project=mobile-chrome"]],
  ] as const) {
    const output = join(
      process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? ".",
      `test-inventory-${engine}.json`,
    );
    execFileSync(
      "bunx",
      ["playwright", "test", ...args, "--list", "--reporter=json"],
      {
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: output },
        stdio: "inherit",
      },
    );
    const report = JSON.parse(readFileSync(output, "utf8")) as JSONReport;
    if (report.errors.length) throw new Error(`${engine} collection failed`);
    function visit(suite: JSONReportSuite) {
      for (const spec of suite.specs) {
        for (const test of spec.tests) {
          if (test.expectedStatus === "skipped") continue;
          tests.push({
            name: `${spec.file}: ${spec.title}`,
            file: spec.file,
            tags: spec.tags.map((tag) => `@${tag}`),
            engine,
          });
        }
      }
      for (const child of suite.suites ?? []) visit(child);
    }
    for (const suite of report.suites) visit(suite);
  }
  const matrix = testMatrix(tests);
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `matrix=${JSON.stringify(matrix)}\n`,
  );
  console.log(
    `${tests.length} tests in ${matrix.include.length} domain / method combinations`,
  );
}
