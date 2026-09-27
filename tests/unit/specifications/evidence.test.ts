import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildEvidenceReport,
  captureEvidence,
  loadEvidence,
  matchTest,
  parseNativeReport,
  validateEvidenceManifest,
} from "../../../scripts/specifications/evidence";
import type { SpecificationFile } from "../../../scripts/specifications/repository";

const root = "/repo";
const reference = {
  file: "tests/unit/example.test.ts",
  name: "example.ownership",
};
const run = { sha: "a".repeat(40), run: "123", attempt: "1" };
const vitest = () => ({
  success: true,
  startTime: 1,
  testResults: [
    {
      name: `${root}/${reference.file}`,
      status: "passed",
      message: "",
      assertionResults: [
        {
          title: reference.name,
          fullName: `authorization ${reference.name}`,
          ancestorTitles: ["authorization"],
          status: "passed",
          failureMessages: [] as string[],
        },
      ],
    },
  ],
});
const playwright = () => ({
  config: { rootDir: "/repo/tests/e2e" },
  errors: [] as unknown[],
  suites: [
    {
      title: "example.spec.ts",
      specs: [],
      suites: [
        {
          title: "authorization",
          specs: [
            {
              id: "unique-case",
              title: reference.name,
              file: "example.spec.ts",
              tests: [
                {
                  projectName: "chromium",
                  expectedStatus: "passed",
                  status: "expected",
                  results: [
                    { status: "passed", retry: 0, errors: [] as unknown[] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
function specifications(
  acceptance: unknown = { test: reference },
  structured = true,
): SpecificationFile[] {
  return [
    {
      path: "docs/features/example.yaml",
      data: {
        requirements: [
          {
            id: "example.ownership",
            ...(structured
              ? { expectation: { type: "authorization" } }
              : { rule: "Owner only" }),
            acceptance,
          },
        ],
      },
    },
  ];
}
const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("native execution evidence", () => {
  test("matches native Vitest results by exact repository file and leaf title", () => {
    const observations = parseNativeReport(vitest(), "vitest", root);
    expect(matchTest(reference, observations)).toMatchObject({
      status: "passed",
      executions: 1,
    });
    expect(
      matchTest({ ...reference, name: "rejects" }, observations),
    ).toMatchObject({ status: "not-run" });
    expect(
      matchTest(
        { ...reference, file: "tests/unit/other.test.ts" },
        observations,
      ),
    ).toMatchObject({ status: "not-run" });
  });
  test("retains failures from earlier successful Vitest retries", () => {
    const report = vitest();
    report.testResults[0].assertionResults[0].failureMessages.push(
      "failed first attempt",
    );
    expect(parseNativeReport(report, "vitest", root)[0].status).toBe("failed");
  });
  test("failed suite hooks invalidate passing tests", () => {
    const report = vitest();
    report.testResults[0].status = "failed";
    expect(parseNativeReport(report, "vitest", root)[0].status).toBe("failed");
  });
  test.each(["skipped", "todo", "disabled"])(
    "Vitest %s is not passing evidence",
    (status) => {
      const report = vitest();
      report.testResults[0].assertionResults[0].status = status;
      expect(parseNativeReport(report, "vitest", root)[0].status).toBe(
        "skipped",
      );
    },
  );
  test("pending Vitest tests have not run successfully", () => {
    const report = vitest();
    report.testResults[0].assertionResults[0].status = "pending";
    expect(parseNativeReport(report, "vitest", root)[0].status).toBe("not-run");
  });
  test("rejects malformed native reports and paths outside the repository", () => {
    expect(() => parseNativeReport({}, "vitest", root)).toThrow();
    expect(() => parseNativeReport({}, "playwright", root)).toThrow();
    const report = vitest();
    report.testResults[0].assertionResults[0].status = "success";
    expect(() => parseNativeReport(report, "vitest", root)).toThrow();
    report.testResults[0].assertionResults[0].status = "passed";
    report.testResults[0].name = "/elsewhere/tests/unit/example.test.ts";
    expect(() => parseNativeReport(report, "vitest", root)).toThrow(
      "outside tests/",
    );
  });
  test("normalizes Playwright testDir-relative paths and nested suites", () => {
    expect(
      parseNativeReport(playwright(), "playwright", root)[0],
    ).toMatchObject({
      file: "tests/e2e/example.spec.ts",
      name: reference.name,
      status: "passed",
      project: "chromium",
    });
  });
  test.each(["failed", "timedOut", "interrupted"])(
    "Playwright %s attempt cannot be hidden by a later pass",
    (status) => {
      const report = playwright();
      report.suites[0].suites[0].specs[0].tests[0].results.unshift({
        status,
        retry: 0,
        errors: [],
      });
      expect(parseNativeReport(report, "playwright", root)[0].status).toBe(
        "failed",
      );
    },
  );
  test("a reported retry without its original attempt is still not accepted", () => {
    const report = playwright();
    report.suites[0].suites[0].specs[0].tests[0].results[0].retry = 1;
    expect(parseNativeReport(report, "playwright", root)[0].status).toBe(
      "failed",
    );
  });
  test("Playwright expected failures and skips cannot prove a requirement", () => {
    const report = playwright();
    report.suites[0].suites[0].specs[0].tests[0].expectedStatus = "failed";
    expect(parseNativeReport(report, "playwright", root)[0].status).toBe(
      "skipped",
    );
    report.suites[0].suites[0].specs[0].tests[0].expectedStatus = "passed";
    report.suites[0].suites[0].specs[0].tests[0].status = "skipped";
    expect(parseNativeReport(report, "playwright", root)[0].status).toBe(
      "skipped",
    );
  });
  test("no Playwright attempts never passes and global errors invalidate evidence", () => {
    const report = playwright();
    report.suites[0].suites[0].specs[0].tests[0].results = [];
    expect(parseNativeReport(report, "playwright", root)[0].status).toBe(
      "not-run",
    );
    report.errors.push({ message: "global teardown failed" });
    expect(parseNativeReport(report, "playwright", root)[0].status).toBe(
      "failed",
    );
  });
  test("all configured Playwright projects must pass", () => {
    const report = playwright();
    const tests = report.suites[0].suites[0].specs[0].tests;
    tests.push({
      ...tests[0],
      projectName: "mobile",
      status: "skipped",
      results: [],
    });
    expect(
      matchTest(
        { ...reference, file: "tests/e2e/example.spec.ts" },
        parseNativeReport(report, "playwright", root),
      ),
    ).toMatchObject({ status: "skipped", executions: 2 });
  });
  test("rejects duplicate report entries and ambiguous leaf names", () => {
    const report = vitest();
    const assertions = report.testResults[0].assertionResults;
    assertions.push({ ...assertions[0] });
    expect(
      matchTest(reference, parseNativeReport(report, "vitest", root)),
    ).toMatchObject({ status: "failed", reason: "ambiguous-test-name" });
    assertions[1].ancestorTitles = ["another authorization suite"];
    assertions[1].fullName = `another authorization suite ${reference.name}`;
    expect(
      matchTest(reference, parseNativeReport(report, "vitest", root)),
    ).toMatchObject({ status: "failed", reason: "ambiguous-test-name" });
  });
  test("merges shards while preserving skipped or failed earlier invocations", () => {
    const passed = parseNativeReport(vitest(), "vitest", root);
    expect(matchTest(reference, [...passed, ...passed])).toMatchObject({
      status: "passed",
      executions: 2,
    });
    expect(
      matchTest(reference, [...passed, { ...passed[0], status: "failed" }]),
    ).toMatchObject({ status: "failed" });
    expect(
      matchTest(reference, [...passed, { ...passed[0], status: "skipped" }]),
    ).toMatchObject({ status: "skipped" });
  });
});

describe("requirement coverage", () => {
  test("distinguishes missing canonical tests from tests not executed", () => {
    expect(
      buildEvidenceReport(specifications(null)).requirements[0].status,
    ).toBe("missing-tests");
    expect(buildEvidenceReport(specifications()).requirements[0].status).toBe(
      "not-run",
    );
  });
  test("requires every requirement's canonical test to pass", () => {
    const files = specifications({
      test: { ...reference, name: "unexecuted" },
    });
    const report = buildEvidenceReport(
      files,
      parseNativeReport(vitest(), "vitest", root),
    );
    expect(report.requirements[0].status).toBe("not-run");
    expect(report.gatePassed).toBe(false);
  });
  test("prose gaps fail the complete evidence gate even when all typed requirements pass", () => {
    const report = buildEvidenceReport(
      [...specifications(), ...specifications(null, false)],
      parseNativeReport(vitest(), "vitest", root),
    );
    expect(report.gatePassed).toBe(false);
    expect(report.summary).toMatchObject({
      total: 2,
      structured: 1,
      unstructured: 1,
      passed: 1,
      "missing-tests": 1,
    });
  });
  test("a fully tested prose requirement has the same evidence status as a typed requirement", () => {
    expect(
      buildEvidenceReport(
        specifications({ test: reference }, false),
        parseNativeReport(vitest(), "vitest", root),
      ).gatePassed,
    ).toBe(true);
  });
  test("reports residual normative text locations without treating strings as atomic requirements", () => {
    const files = specifications();
    files[0].data.access = { user: "Owner only" };
    files[0].data.capabilities = {
      list: {
        notes: ["At most 100"],
        presentation: {
          items: ["Hide if empty"],
          requirement_refs: ["example.ownership"],
        },
      },
    };
    const report = buildEvidenceReport(files);
    expect(report.summary.total).toBe(1);
    expect(report.summary.unstructuredTextCandidates).toBe(3);
    expect(
      report.unstructuredTextCandidates.map(({ location }) => location),
    ).toEqual([
      "/access/user",
      "/capabilities/list/notes/0",
      "/capabilities/list/presentation/items/0",
    ]);
    expect(report.evidenceMeaning).toContain("not independent proof");
  });
  test("empty inventories and inventories without typed requirements cannot pass vacuously", () => {
    expect(buildEvidenceReport([]).gatePassed).toBe(false);
    expect(buildEvidenceReport(specifications(null, false)).gatePassed).toBe(
      false,
    );
  });
});

describe("workflow provenance", () => {
  test("rejects wrong commit, run, attempt, unsafe filenames and duplicate reports", () => {
    const manifest = {
      ...run,
      root,
      outcome: "success",
      reports: [{ runner: "vitest", file: "vitest-123.json" }],
    };
    expect(validateEvidenceManifest(manifest, run)).toEqual(manifest);
    expect(
      validateEvidenceManifest(manifest, { ...run, attempt: "2" }),
    ).toEqual(manifest);
    expect(() =>
      validateEvidenceManifest({ ...manifest, attempt: "2" }, run),
    ).toThrow("newer");
    expect(() =>
      validateEvidenceManifest({ ...manifest, attempt: "invalid" }, run),
    ).toThrow();
    for (const field of ["sha", "run"] as const)
      expect(() =>
        validateEvidenceManifest(
          { ...manifest, [field]: field === "run" ? "456" : "other" },
          run,
        ),
      ).toThrow("does not match");
    expect(() =>
      validateEvidenceManifest(
        {
          ...manifest,
          reports: [{ runner: "vitest", file: "../vitest-123.json" }],
        },
        run,
      ),
    ).toThrow("Unsafe");
    expect(() =>
      validateEvidenceManifest(
        { ...manifest, reports: [...manifest.reports, ...manifest.reports] },
        run,
      ),
    ).toThrow("Duplicate");
  });
  test("captures and loads native artifacts from this workflow execution only", async () => {
    const directory = await mkdtemp(join(tmpdir(), "spec-evidence-"));
    directories.push(directory);
    const artifact = join(directory, "spec-evidence-unit");
    await mkdir(artifact);
    await writeFile(join(artifact, "vitest-1.json"), JSON.stringify(vitest()));
    vi.stubEnv("GITHUB_SHA", run.sha);
    vi.stubEnv("GITHUB_RUN_ID", run.run);
    vi.stubEnv("GITHUB_RUN_ATTEMPT", run.attempt);
    vi.stubEnv("SPEC_EVIDENCE_OUTCOME", "success");
    await captureEvidence(artifact, root);
    expect((await loadEvidence(directory, run)).observations).toHaveLength(1);
    expect(
      (await loadEvidence(directory, { ...run, attempt: "2" })).observations,
    ).toHaveLength(1);
  });
  test("rejects manifests without an explicit phase outcome", () => {
    const manifest = { ...run, root, reports: [] };
    expect(() => validateEvidenceManifest(manifest, run)).toThrow();
    expect(() =>
      validateEvidenceManifest({ ...manifest, outcome: "passed" }, run),
    ).toThrow();
  });
  test.each(["success", "failure", "cancelled", "skipped"] as const)(
    "keeps %s phase outcome even when native Vitest reports every assertion passed",
    async (outcome) => {
      const directory = await mkdtemp(join(tmpdir(), "spec-evidence-"));
      directories.push(directory);
      const artifact = join(directory, "spec-evidence-unit");
      await mkdir(artifact);
      // Vitest's native JSON can report success:true despite an unhandled
      // rejection that makes the process exit 1. The phase is authoritative.
      const native = vitest();
      expect(parseNativeReport(native, "vitest", root)[0].status).toBe(
        "passed",
      );
      await writeFile(join(artifact, "vitest-1.json"), JSON.stringify(native));
      vi.stubEnv("GITHUB_SHA", run.sha);
      vi.stubEnv("GITHUB_RUN_ID", run.run);
      vi.stubEnv("GITHUB_RUN_ATTEMPT", run.attempt);
      vi.stubEnv("SPEC_EVIDENCE_OUTCOME", outcome);
      await captureEvidence(artifact, root);
      const evidence = await loadEvidence(directory, run);
      const report = buildEvidenceReport(
        specifications(),
        evidence.observations,
        evidence.executions,
      );
      expect(report.gatePassed).toBe(outcome === "success");
      expect(report.requirements[0].status).toBe(
        outcome === "success" ? "passed" : "failed",
      );
      expect(report.executionFailures).toHaveLength(
        outcome === "success" ? 0 : 1,
      );
      expect(report.executions[0]).toEqual({
        ...run,
        artifact: "spec-evidence-unit",
        outcome,
      });
      expect(report.provenance[0]).toMatchObject({
        ...run,
        outcome,
        report: "vitest-1.json",
      });
    },
  );
  test.each(["failure", "cancelled", "skipped"] as const)(
    "an empty %s phase invalidates evidence even when all bound tests pass elsewhere",
    async (outcome) => {
      const directory = await mkdtemp(join(tmpdir(), "spec-evidence-"));
      directories.push(directory);
      const artifact = join(directory, "spec-evidence-integration");
      await mkdir(artifact);
      await writeFile(
        join(artifact, "manifest.json"),
        JSON.stringify({ ...run, root, outcome, reports: [] }),
      );
      const evidence = await loadEvidence(directory, run);
      const passed = parseNativeReport(vitest(), "vitest", root);
      const report = buildEvidenceReport(
        specifications(),
        passed,
        evidence.executions,
      );
      expect(report.requirements[0].status).toBe("passed");
      expect(report.gatePassed).toBe(false);
      expect(report.summary.unsuccessfulExecutions).toBe(1);
      expect(report.executionFailures[0]).toMatchObject({
        artifact: "spec-evidence-integration",
        outcome,
      });
    },
  );
  test("empty downloads cannot become passing evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "spec-evidence-"));
    directories.push(directory);
    await expect(loadEvidence(directory, run)).rejects.toThrow(
      "No workflow evidence",
    );
  });
});
