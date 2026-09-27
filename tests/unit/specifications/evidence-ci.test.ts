import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { parse as parseYaml, stringify } from "yaml";
import {
  buildEvidenceReport,
  loadEvidence,
  runEvidenceCoverage,
} from "../../../scripts/specifications/evidence";
import {
  MANDATORY_CI_JOBS,
  MANDATORY_EVIDENCE_ARTIFACTS,
  MANDATORY_EVIDENCE_JOBS,
  validateMandatoryJobResults,
} from "../../../scripts/specifications/evidence-ci";

const run = { sha: "a".repeat(40), run: "123", attempt: "2" };
const reference = {
  file: "tests/unit/specifications/native-evidence-probe.test.ts",
  name: "example.native",
};
const specifications = [
  {
    path: "docs/features/example.yaml",
    data: {
      kind: "feature",
      id: "example",
      name: "Native evidence probe",
      areas: ["platform"],
      capabilities: {
        probe: {
          title: "Probe",
          auth: "anon",
          presentation: { kind: "protocol", items: ["Native probe"] },
        },
      },
      requirements: [
        {
          id: reference.name,
          category: "behavior",
          rule: "Native execution",
          acceptance: {
            given: "The probe",
            when: "It executes",
            // biome-ignore lint/suspicious/noThenProperty: Specification acceptance uses a data-only then array.
            then: ["It passes"],
            test: reference,
          },
        },
      ],
    },
  },
];
const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function completeSpecificationRoot() {
  const root = await mkdtemp(join(tmpdir(), "spec-evidence-root-"));
  directories.push(root);
  await mkdir(join(root, "docs/features"), { recursive: true });
  await cp(
    new URL("../../../docs/schemas", import.meta.url),
    join(root, "docs/schemas"),
    { recursive: true },
  );
  await writeFile(
    join(root, specifications[0].path),
    stringify(specifications[0].data),
  );
  await mkdir(dirname(join(root, reference.file)), { recursive: true });
  await writeFile(
    join(root, reference.file),
    'import { expect, test } from "vitest";\ntest("example.native", () => expect(2 + 3).toBe(5));\n',
  );
  vi.stubEnv("GITHUB_SHA", run.sha);
  vi.stubEnv("GITHUB_RUN_ID", run.run);
  vi.stubEnv("GITHUB_RUN_ATTEMPT", run.attempt);
  vi.stubEnv("SPEC_EVIDENCE_NEEDS", JSON.stringify(successfulNeeds()));
  return root;
}

function successfulNeeds() {
  return Object.fromEntries(
    MANDATORY_CI_JOBS.map((job) => [job, { result: "success" }]),
  );
}
async function nativeReport(runner: "vitest" | "playwright") {
  return JSON.parse(
    await readFile(
      new URL(
        `../../fixtures/specifications/native-${runner}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
}
async function artifacts(omitted?: string) {
  const directory = await mkdtemp(join(tmpdir(), "spec-evidence-ci-"));
  directories.push(directory);
  for (const [artifact, runner] of MANDATORY_EVIDENCE_ARTIFACTS) {
    if (artifact === omitted) continue;
    const path = join(directory, artifact);
    await mkdir(path);
    await writeFile(
      join(path, `${runner}-1.json`),
      JSON.stringify(await nativeReport(runner)),
    );
    await writeFile(
      join(path, "manifest.json"),
      JSON.stringify({
        ...run,
        root: "/repo",
        outcome: "success",
        reports: [{ runner, file: `${runner}-1.json` }],
      }),
    );
  }
  return directory;
}

test("all mandatory partitions with actual native reporter fixtures can pass", async () => {
  validateMandatoryJobResults(successfulNeeds());
  const evidence = await loadEvidence(await artifacts(), run);
  const report = buildEvidenceReport(
    specifications,
    evidence.observations,
    evidence.executions,
  );
  expect(evidence.executions).toHaveLength(16);
  expect(evidence.observations).toHaveLength(16);
  expect(report.gatePassed).toBe(true);
  expect(report.missingArtifacts).toEqual([]);
});

test("the production enforcement entrypoint checks bindings, needs and missing native partitions", async () => {
  const root = await completeSpecificationRoot();
  const directory = await artifacts();
  const output = join(root, "coverage.json");
  const args = ["--results", directory, "--output", output, "--enforce"];
  expect((await runEvidenceCoverage(args, root)).gatePassed).toBe(true);
  for (const result of ["failure", "cancelled", "skipped"]) {
    const needs = successfulNeeds();
    needs.check = { result };
    vi.stubEnv("SPEC_EVIDENCE_NEEDS", JSON.stringify(needs));
    await expect(runEvidenceCoverage(args, root)).rejects.toThrow(
      "Mandatory CI jobs did not succeed: check",
    );
  }
  vi.stubEnv("SPEC_EVIDENCE_NEEDS", "");
  await expect(runEvidenceCoverage(args, root)).rejects.toThrow();
  vi.stubEnv("SPEC_EVIDENCE_NEEDS", JSON.stringify(successfulNeeds()));
  await rm(join(directory, "spec-evidence-life_ustc_rls"), { recursive: true });
  await expect(runEvidenceCoverage(args, root)).rejects.toThrow(
    "Specification evidence gate failed",
  );
  expect(JSON.parse(await readFile(output, "utf8")).missingArtifacts).toEqual([
    "spec-evidence-life_ustc_rls",
  ]);
});

test.each([...MANDATORY_EVIDENCE_ARTIFACTS.keys()])(
  "missing mandatory artifact %s fails even when the canonical test passed elsewhere",
  async (artifact) => {
    const evidence = await loadEvidence(await artifacts(artifact), run);
    const report = buildEvidenceReport(
      specifications,
      evidence.observations,
      evidence.executions,
    );
    expect(report.requirements[0].status).toBe("passed");
    expect(report.missingArtifacts).toEqual([artifact]);
    expect(report.gatePassed).toBe(false);
  },
);

test.each(MANDATORY_CI_JOBS)(
  "%s must succeed independently of its artifacts",
  (job) => {
    for (const result of ["failure", "cancelled", "skipped"]) {
      const needs = successfulNeeds();
      needs[job] = { result };
      expect(() => validateMandatoryJobResults(needs)).toThrow(job);
    }
    const missing = successfulNeeds();
    delete missing[job];
    expect(() => validateMandatoryJobResults(missing)).toThrow(job);
    expect(() => validateMandatoryJobResults(null)).toThrow("required");
  },
);

test("previous-attempt artifacts cannot fill a failed current-attempt producer", async () => {
  const directory = await artifacts();
  const path = join(directory, "spec-evidence-life_ustc_rls", "manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, JSON.stringify({ ...manifest, attempt: "1" }));
  await expect(loadEvidence(directory, run)).rejects.toThrow(
    "attempt does not match",
  );
});

test.each(["failure", "cancelled", "skipped"])(
  "a %s RLS phase fails despite passed native assertions",
  async (outcome) => {
    const directory = await artifacts();
    const path = join(
      directory,
      "spec-evidence-life_ustc_rls",
      "manifest.json",
    );
    const manifest = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...manifest, outcome }));
    const evidence = await loadEvidence(directory, run);
    const report = buildEvidenceReport(
      specifications,
      evidence.observations,
      evidence.executions,
    );
    expect(report.gatePassed).toBe(false);
    expect(report.executionFailures).toHaveLength(1);
  },
);

test("a successful mandatory producer must have executed native tests", async () => {
  const directory = await artifacts();
  const path = join(directory, "spec-evidence-life_ustc_rls", "vitest-1.json");
  const report = await nativeReport("vitest");
  report.testResults[0].assertionResults[0].status = "skipped";
  await writeFile(path, JSON.stringify(report));
  await expect(loadEvidence(directory, run)).rejects.toThrow(
    "no executed native tests",
  );
  report.testResults = [];
  await writeFile(path, JSON.stringify(report));
  await expect(loadEvidence(directory, run)).rejects.toThrow(
    "no executed native tests",
  );
});

test("missing manifests and empty successful manifests cannot substitute for a completed partition", async () => {
  const directory = await artifacts();
  const path = join(directory, "spec-evidence-life_ustc_rls", "manifest.json");
  await writeFile(
    path,
    JSON.stringify({ ...run, root: "/repo", outcome: "success", reports: [] }),
  );
  await expect(loadEvidence(directory, run)).rejects.toThrow(
    "no executed native tests",
  );
  await rm(path);
  await expect(loadEvidence(directory, run)).rejects.toThrow("ENOENT");
});

test("a successful phase cannot conceal an unbound native failure", async () => {
  const directory = await artifacts();
  const path = join(
    directory,
    "spec-evidence-life_ustc_rest_1",
    "playwright-1.json",
  );
  const report = await nativeReport("playwright");
  report.suites[0].specs[0].tests[0].results[0].status = "failed";
  await writeFile(path, JSON.stringify(report));
  await expect(loadEvidence(directory, run)).rejects.toThrow(
    "contains failed native tests",
  );
});

test("a native report from the wrong runner cannot stand in for a browser partition", async () => {
  const directory = await artifacts();
  const path = join(directory, "spec-evidence-life_ustc_e2e_8");
  await writeFile(
    join(path, "vitest-1.json"),
    JSON.stringify(await nativeReport("vitest")),
  );
  await writeFile(
    join(path, "manifest.json"),
    JSON.stringify({
      ...run,
      root: "/repo",
      outcome: "success",
      reports: [{ runner: "vitest", file: "vitest-1.json" }],
    }),
  );
  await expect(loadEvidence(directory, run)).rejects.toThrow(
    "Wrong native runner",
  );
});

test("CI dependencies and native artifact inventory cover every mandatory job and partition", async () => {
  const readWorkflow = async (filename: string) =>
    parseYaml(
      await readFile(
        new URL(`../../../.github/workflows/${filename}`, import.meta.url),
        "utf8",
      ),
    );
  const ci = await readWorkflow("ci.yml");
  const bun = await readWorkflow("bun-job.yml");
  const db = await readWorkflow("db-backed-bun-job.yml");
  const exemptJobs = [
    "specification-evidence",
    "test-visual-regression",
    "publish-e2e-html-report",
  ];
  expect(
    Object.keys(ci.jobs)
      .filter((job) => !exemptJobs.includes(job))
      .sort(),
  ).toEqual([...MANDATORY_CI_JOBS].sort());
  expect(ci.jobs["specification-evidence"].needs.slice().sort()).toEqual(
    [...MANDATORY_CI_JOBS].sort(),
  );
  expect(ci.jobs["specification-evidence"].with["specification-needs"]).toBe(
    "${" + "{ toJSON(needs) }}",
  );
  const phase = bun.jobs.run.steps.find(
    (step: { name: string }) => step.name === "Run job phase",
  );
  expect(phase.env.SPEC_EVIDENCE_NEEDS).toBe(
    "${" + "{ inputs.specification-needs }}",
  );
  expect(phase.run).toContain(
    "coverage --results downloaded-spec-evidence --output spec-coverage.json --enforce",
  );
  const unitUpload = bun.jobs.run.steps.find(
    (step: { name: string }) => step.name === "Upload unit execution evidence",
  );
  expect(MANDATORY_EVIDENCE_JOBS["test-unit"].artifacts).toEqual([
    unitUpload.with.name,
  ]);
  const dbUpload = db.jobs.run.steps.find(
    (step: { name: string }) => step.name === "Upload test execution evidence",
  );
  expect(dbUpload.with.name).toBe(
    "spec-evidence-${" + "{ inputs.database-name }}",
  );
  for (const [job, expected] of Object.entries(MANDATORY_EVIDENCE_JOBS)) {
    if (job === "test-unit") continue;
    const producer = ci.jobs[job];
    const databases = producer.strategy?.matrix.include.map(
      (entry: { database: string }) => entry.database,
    ) ?? [producer.with["database-name"]];
    expect(
      databases.map((database: string) => `spec-evidence-${database}`).sort(),
      job,
    ).toEqual([...expected.artifacts].sort());
  }
});
