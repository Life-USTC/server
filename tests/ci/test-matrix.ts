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
type Combination = {
  tag: string;
  weight: number;
  integration: boolean;
  integrationFiles: string[];
  http: boolean;
  browser: boolean;
};

// Relative cost of one case on each runner, from a complete CI run: an
// in-process case is far cheaper than one that drives a Worker or a browser.
// Only the ratios matter. They balance jobs; they do not predict wall time.
const ENGINE_WEIGHT: Record<Engine, number> = {
  integration: 1,
  http: 3,
  browser: 4,
};

// Every job pays for a checkout, a Bun install, a database and (for browser
// work) a Chromium download. Running one job per combination spends more of
// the run on that fixed cost than on tests, so combinations are packed into
// roughly this many jobs instead.
const TARGET_JOBS = 24;

function slug(tag: string) {
  return tag.slice(1).replace("/", "-").toLowerCase();
}

// Tags declare ownership in the tests. This deduplicates combinations and
// packs them into balanced jobs; native runners retain responsibility for
// discovery and execution.
export function testMatrix(tests: TestOwner[]) {
  const knownTags = new Set(testTags.map((tag) => tag.name));
  const combinations = new Map<string, Combination>();
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
    const combination = combinations.get(tag) ?? {
      tag,
      weight: 0,
      integration: false,
      integrationFiles: [] as string[],
      http: false,
      browser: false,
    };
    combination[test.engine] = true;
    combination.weight += ENGINE_WEIGHT[test.engine];
    if (test.engine === "integration") {
      if (!test.file) throw new Error(`${test.name}: missing integration file`);
      if (!combination.integrationFiles.includes(test.file))
        combination.integrationFiles.push(test.file);
    }
    combinations.set(tag, combination);
  }
  if (!combinations.size) throw new Error("No test combinations collected");

  // Heaviest first, so the large combinations claim a job before the rest fill
  // the gaps around them.
  const ordered = [...combinations.values()].sort(
    (a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag),
  );
  const total = ordered.reduce((sum, one) => sum + one.weight, 0);
  // Weight counts cases, and a slow case can cost several times a fast one, so
  // a job's real time only loosely tracks its weight. Keep the budget at an
  // even share of the work: a combination heavier than that still gets a job to
  // itself, and the smaller budget bounds how far the rest can drift.
  const budget = Math.ceil(total / TARGET_JOBS);

  const jobs: (Combination & { members: string[] })[] = [];
  for (const one of ordered) {
    const fit = jobs.find((job) => job.weight + one.weight <= budget);
    if (!fit) {
      // Copy the file list: merging appends to the job's own array, which would
      // otherwise still be the combination's.
      jobs.push({
        ...one,
        integrationFiles: [...one.integrationFiles],
        members: [one.tag],
      });
      continue;
    }
    fit.weight += one.weight;
    fit.members.push(one.tag);
    fit.integration ||= one.integration;
    fit.http ||= one.http;
    fit.browser ||= one.browser;
    for (const file of one.integrationFiles)
      if (!fit.integrationFiles.includes(file)) fit.integrationFiles.push(file);
  }
  if (jobs.length > 256)
    throw new Error("Test combinations exceed the CI matrix limit");

  return {
    include: jobs.map((job) => {
      const [primary, ...rest] = job.members;
      return {
        // The heaviest combination names the job; a failure still points at a
        // domain before anyone opens the log.
        name: `${primary.slice(1).replace("/", " / ")}${
          rest.length ? ` +${rest.length}` : ""
        }`,
        slug: slug(primary),
        // Reported so an unbalanced run is visible without timing every job.
        weight: job.weight,
        // Vitest accepts a tag expression; Playwright accepts a regular
        // expression over the same tags.
        tags: job.members.join(" || "),
        grep: `@(${job.members.map((tag) => tag.slice(1)).join("|")})( |$)`,
        integration: job.integration,
        integrationFiles: job.integrationFiles,
        http: job.http,
        browser: job.browser,
      };
    }),
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
  const summary = `${tests.length} tests in ${combinations} domain / method combinations packed into ${matrix.include.length} jobs`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
