import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

type WorkflowJob = {
  needs?: string | string[];
  steps?: Array<{
    name?: string;
    run?: string;
  }>;
  strategy?: {
    matrix?: {
      include?: Array<Record<string, unknown>>;
    };
  };
  with?: Record<string, unknown>;
};

type Workflow = {
  jobs?: Record<string, WorkflowJob>;
};

async function readWorkflow(path: string): Promise<Workflow> {
  const source = await readFile(
    new URL(`../../../${path}`, import.meta.url),
    "utf8",
  );
  return parseYaml(source) as Workflow;
}

function jobNeeds(job: WorkflowJob | undefined): string[] {
  if (!job?.needs) return [];
  return Array.isArray(job.needs) ? job.needs : [job.needs];
}

async function readWorkflows() {
  const [ci, dbBacked] = await Promise.all([
    readWorkflow(".github/workflows/ci.yml"),
    readWorkflow(".github/workflows/db-backed-bun-job.yml"),
  ]);

  return {
    ciJobs: ci.jobs ?? {},
    dbBackedRun: dbBacked.jobs?.run,
  };
}

describe("CI server test parallelism", () => {
  it("keeps independent checks independent and gates runtime consumers on build only", async () => {
    const { ciJobs } = await readWorkflows();

    for (const jobId of [
      "check",
      "test-unit",
      "test-integration",
      "test-rls",
      "build-e2e-artifacts",
    ]) {
      expect(jobNeeds(ciJobs[jobId]), jobId).toEqual([]);
    }

    for (const jobId of ["test-rest", "test-e2e", "test-visual-regression"]) {
      expect(jobNeeds(ciJobs[jobId]), jobId).toEqual(["build-e2e-artifacts"]);
    }

    expect(jobNeeds(ciJobs["test-e2e"])).not.toContain("test-integration");
  });

  it("shares the one application build artifact with REST, E2E, and visual tests", async () => {
    const { ciJobs } = await readWorkflows();
    const buildInputs = ciJobs["build-e2e-artifacts"]?.with;

    expect(buildInputs?.["upload-artifact-name"]).toBe("e2e-svelte-kit");
    expect(buildInputs?.["upload-artifact-path"]).toBe(".svelte-kit");

    for (const jobId of ["test-rest", "test-e2e", "test-visual-regression"]) {
      const inputs = ciJobs[jobId]?.with;
      expect(inputs?.["download-artifact-name"], jobId).toBe("e2e-svelte-kit");
      expect(inputs?.["download-artifact-path"], jobId).toBe(".svelte-kit");
    }

    const buildArtifactUploads = Object.values(ciJobs).filter(
      (job) => job.with?.["upload-artifact-name"] === "e2e-svelte-kit",
    );
    expect(buildArtifactUploads).toHaveLength(1);
  });

  it("partitions integration files into four isolated database jobs", async () => {
    const { ciJobs, dbBackedRun } = await readWorkflows();
    const integration = ciJobs["test-integration"];
    const entries = integration?.strategy?.matrix?.include ?? [];
    const databases = entries.map((entry) => entry.database);

    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.index)).toEqual([1, 2, 3, 4]);
    expect(new Set(databases).size).toBe(4);
    expect(databases.every((database) => typeof database === "string")).toBe(
      true,
    );
    expect(integration?.with?.["vitest-shard"]).toBe(
      "${" + "{ matrix.index }}/4",
    );

    const phaseRun = dbBackedRun?.steps?.find(
      (step) => step.name === "Run job phase",
    )?.run;
    expect(phaseRun).toEqual(expect.any(String));
    const phaseSource = phaseRun ?? "";
    const integrationPhase = phaseSource.slice(
      phaseSource.indexOf("ci:integration)"),
      phaseSource.indexOf("ci:rest)"),
    );
    expect(integrationPhase).toMatch(
      /bunx vitest run[\s\S]*--config vitest\.integration\.config\.ts[\s\S]*--shard=/,
    );
    expect(integrationPhase).toContain(
      "source tests/ci/setup-runtime-database.sh",
    );

    const e2eEntries = ciJobs["test-e2e"]?.strategy?.matrix?.include ?? [];
    expect(e2eEntries).toHaveLength(4);
    expect(e2eEntries.map((entry) => entry.shard)).toEqual([
      "1/4",
      "2/4",
      "3/4",
      "4/4",
    ]);
  });

  it("keeps the unit coverage phase and its artifact separate", async () => {
    const { ciJobs, dbBackedRun } = await readWorkflows();
    const unitInputs = ciJobs["test-unit"]?.with;

    expect(unitInputs?.["job-phase"]).toBe("ci:unit");
    expect(unitInputs?.["upload-artifact-name"]).toBe("vitest-coverage");
    expect(unitInputs?.["upload-artifact-path"]).toBe("coverage");

    const environmentRun = dbBackedRun?.steps?.find(
      (step) => step.name === "Configure job environment",
    )?.run;
    expect(environmentRun).toMatch(
      /JOB_PHASE.*ci:verify.*ci:unit|ci:unit.*JOB_PHASE.*ci:verify/s,
    );
  });
});
