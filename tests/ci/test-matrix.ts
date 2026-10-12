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
type Group = {
  domain: string;
  tags: string[];
  weight: number;
  integration: boolean;
  integrationFiles: string[];
  http: boolean;
  browser: boolean;
};

// Relative cost of one case on each runner, from a complete CI run: an
// in-process case is far cheaper than one that drives a Worker or a browser.
// Only the ratios matter, and only for ordering: GitHub starts matrix jobs in
// the order they are listed, so the longest feature claims a runner first.
const ENGINE_WEIGHT: Record<Engine, number> = {
  integration: 1,
  http: 3,
  browser: 4,
};

// Tags declare ownership in the tests. This collects each feature's methods
// into one job, so a job is named after the feature it covers; native runners
// retain responsibility for discovery and execution.
export function testMatrix(tests: TestOwner[]) {
  const knownTags = new Set(testTags.map((tag) => tag.name));
  const groups = new Map<string, Group>();
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
    const domain = tag.slice(1, tag.indexOf("/"));
    const group = groups.get(domain) ?? {
      domain,
      tags: [] as string[],
      weight: 0,
      integration: false,
      integrationFiles: [] as string[],
      http: false,
      browser: false,
    };
    if (!group.tags.includes(tag)) group.tags.push(tag);
    group[test.engine] = true;
    group.weight += ENGINE_WEIGHT[test.engine];
    if (test.engine === "integration") {
      if (!test.file) throw new Error(`${test.name}: missing integration file`);
      if (!group.integrationFiles.includes(test.file))
        group.integrationFiles.push(test.file);
    }
    groups.set(domain, group);
  }
  if (!groups.size) throw new Error("No test combinations collected");
  if (groups.size > 256)
    throw new Error("Test combinations exceed the CI matrix limit");

  return {
    include: [...groups.values()]
      // Longest first: GitHub hands out runners in this order, and a run ends
      // when the last job to start finishes.
      .sort((a, b) => b.weight - a.weight || a.domain.localeCompare(b.domain))
      .map((group) => ({
        name: group.domain,
        slug: group.domain.toLowerCase(),
        // Vitest accepts a tag expression; every method of one feature shares
        // a tag prefix, which is all Playwright needs to match.
        tags: group.tags.toSorted().join(" || "),
        grep: `@${group.domain}/`,
        integration: group.integration,
        integrationFiles: group.integrationFiles,
        http: group.http,
        browser: group.browser,
      })),
  };
}

if (import.meta.main) {
  const tests: TestOwner[] = [];
  const { createVitest } = await import("vitest/node");
  const vitest = await createVitest({
    config: "vitest.integration.config.ts",
    watch: false,
    // Discovery needs declarations only. Execution still validates database roles.
    globalSetup: [],
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
  const combinations = new Set(tests.flatMap((test) => test.tags)).size;
  const summary = `${tests.length} tests in ${combinations} domain / method combinations across ${matrix.include.length} feature jobs`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
