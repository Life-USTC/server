import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import {
  MANDATORY_EVIDENCE_ARTIFACTS,
  validateMandatoryJobResults,
} from "./evidence-ci";
import {
  type Requirement,
  readSpecifications,
  type SpecificationFile,
  type TestReference,
} from "./repository";
import { validateSemanticReceipt } from "./semantic-receipt";
import { checkSpecifications, collectRequirements } from "./validate";
import { repositoryRoot } from "./yaml";

export type EvidenceStatus =
  | "missing-tests"
  | "not-run"
  | "skipped"
  | "failed"
  | "passed";
export type ExecutionOutcome = "success" | "failure" | "cancelled" | "skipped";
export type EvidenceExecution = {
  artifact: string;
  sha: string;
  run: string;
  attempt: string;
  outcome: ExecutionOutcome;
};
export type TestObservation = TestReference & {
  identity: string;
  source?: EvidenceExecution & { report: string };
  project: string;
  ambiguous?: boolean;
  semanticReceipt?: unknown;
  status: "not-run" | "skipped" | "failed" | "passed";
};
const nonempty = z.string().min(1);
const vitestReport = z.object({
  success: z.boolean(),
  startTime: z.number().finite(),
  testResults: z.array(
    z.object({
      name: nonempty,
      status: z.enum(["failed", "passed"]),
      message: z.string(),
      assertionResults: z.array(
        z.object({
          title: nonempty,
          fullName: nonempty,
          ancestorTitles: z.array(z.string()),
          status: z.enum([
            "passed",
            "failed",
            "skipped",
            "pending",
            "todo",
            "disabled",
          ]),
          failureMessages: z.array(z.string()).nullable(),
          meta: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
    }),
  ),
});
const playwrightSpec = z.object({
  id: nonempty,
  title: nonempty,
  file: nonempty,
  tests: z.array(
    z.object({
      projectName: z.string(),
      expectedStatus: z.enum([
        "passed",
        "failed",
        "timedOut",
        "skipped",
        "interrupted",
      ]),
      status: z.enum(["skipped", "expected", "unexpected", "flaky"]),
      annotations: z
        .array(
          z.object({ type: z.string(), description: z.string().optional() }),
        )
        .optional(),
      results: z.array(
        z.object({
          status: z
            .enum(["passed", "failed", "timedOut", "skipped", "interrupted"])
            .optional(),
          retry: z.number().int().nonnegative(),
          errors: z.array(z.unknown()),
        }),
      ),
    }),
  ),
});
type PlaywrightSuite = {
  title: string;
  specs: z.infer<typeof playwrightSpec>[];
  suites?: PlaywrightSuite[];
};
const playwrightSuite: z.ZodType<PlaywrightSuite> = z.lazy(() =>
  z.object({
    title: z.string(),
    specs: z.array(playwrightSpec),
    suites: z.array(playwrightSuite).optional(),
  }),
);
const playwrightReport = z.object({
  config: z.object({ rootDir: nonempty }),
  errors: z.array(z.unknown()),
  suites: z.array(playwrightSuite),
});

function repositoryFile(file: string, root: string, base = root) {
  const normalized = relative(root, resolve(base, file)).replaceAll("\\", "/");
  if (!normalized.startsWith("tests/") || normalized.split("/").includes(".."))
    throw new Error(`Evidence test path is outside tests/: ${file}`);
  return normalized;
}

/** Read native reporter output, never infer execution from test source text. */
export function parseNativeReport(
  value: unknown,
  runner: "vitest" | "playwright",
  root: string,
): TestObservation[] {
  if (!isAbsolute(root))
    throw new Error("Evidence repository root must be absolute");
  const observations: TestObservation[] = [];
  if (runner === "vitest") {
    const report = vitestReport.parse(value);
    for (const suite of report.testResults) {
      for (const test of suite.assertionResults) {
        observations.push({
          file: repositoryFile(suite.name, root),
          name: test.title,
          identity: JSON.stringify([...test.ancestorTitles, test.title]),
          project: "vitest",
          semanticReceipt: test.meta?.specification,
          // Vitest preserves retry errors in native failureMessages. A suite
          // hook failure also invalidates otherwise passing tests in that file.
          status:
            !report.success ||
            suite.status === "failed" ||
            suite.message ||
            test.status === "failed" ||
            test.failureMessages?.length
              ? "failed"
              : test.status === "passed"
                ? "passed"
                : test.status === "pending"
                  ? "not-run"
                  : "skipped",
        });
      }
    }
  } else {
    const report = playwrightReport.parse(value);
    const walk = (suites: PlaywrightSuite[], ancestors: string[]) => {
      for (const suite of suites) {
        const titles = [...ancestors, suite.title];
        for (const spec of suite.specs) {
          for (const test of spec.tests) {
            let status: TestObservation["status"] = "passed";
            if (
              report.errors.length ||
              test.status === "unexpected" ||
              test.status === "flaky" ||
              test.results.some(
                (result) =>
                  result.errors.length ||
                  ["failed", "timedOut", "interrupted"].includes(
                    result.status ?? "",
                  ) ||
                  result.retry > 0,
              )
            )
              status = "failed";
            else if (
              test.status === "skipped" ||
              test.expectedStatus !== "passed" ||
              test.results.some((result) => result.status === "skipped")
            )
              status = "skipped";
            else if (
              !test.results.length ||
              test.results.some((result) => result.status !== "passed")
            )
              status = "not-run";
            observations.push({
              file: repositoryFile(spec.file, root, report.config.rootDir),
              name: spec.title,
              identity: JSON.stringify([...titles, spec.title]),
              project: test.projectName,
              status,
              semanticReceipt: parseSemanticAnnotations(test.annotations ?? []),
            });
          }
        }
        walk(suite.suites ?? [], titles);
      }
    };
    walk(report.suites, []);
  }
  // Parameterized tests may have identical generated names. Keep unrelated
  // evidence usable, but refuse to bind an ambiguous declaration to a spec.
  const identities = new Map<string, TestObservation>();
  for (const observation of observations) {
    const key = JSON.stringify([
      observation.file,
      observation.identity,
      observation.project,
    ]);
    const previous = identities.get(key);
    if (previous) {
      previous.ambiguous = true;
      observation.ambiguous = true;
    }
    identities.set(key, observation);
  }
  return observations;
}

function parseSemanticAnnotations(
  annotations: { type: string; description?: string }[],
): unknown {
  const semantic = annotations.filter(({ type }) => type === "specification");
  if (!semantic.length) return undefined;
  if (semantic.length !== 1) return { invalid: "duplicate semantic receipts" };
  try {
    return JSON.parse(semantic[0].description ?? "null");
  } catch {
    return { invalid: "malformed semantic receipt" };
  }
}

const precedence: EvidenceStatus[] = [
  "missing-tests",
  "failed",
  "skipped",
  "not-run",
  "passed",
];
function combinedStatus(statuses: EvidenceStatus[]): EvidenceStatus {
  return precedence.find((status) => statuses.includes(status)) ?? "not-run";
}
export function matchTest(
  reference: TestReference,
  observations: TestObservation[],
) {
  const matches = observations.filter(
    (test) => test.file === reference.file && test.name === reference.name,
  );
  if (!matches.length)
    return { ...reference, status: "not-run" as EvidenceStatus, executions: 0 };
  if (
    matches.some((test) => test.ambiguous) ||
    new Set(matches.map((test) => test.identity)).size !== 1
  )
    return {
      ...reference,
      status: "failed" as EvidenceStatus,
      executions: matches.length,
      reason: "ambiguous-test-name",
    };
  return {
    ...reference,
    status: matches.some(
      (test) => test.source && test.source.outcome !== "success",
    )
      ? ("failed" as EvidenceStatus)
      : combinedStatus(matches.map((test) => test.status)),
    executions: matches.length,
    results: matches.map(({ project, status, source }) => ({
      project,
      status,
      source,
    })),
  };
}

function residualTextLocations(
  value: unknown,
  path = "",
  selected = false,
): string[] {
  if (typeof value === "string") return selected ? [path] : [];
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      residualTextLocations(item, `${path}/${index}`, selected),
    );
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) =>
    key === "requirement_refs" ||
    (path.endsWith("/presentation") && ["kind", "views"].includes(key))
      ? []
      : residualTextLocations(
          item,
          `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
          selected || ["access", "notes", "presentation"].includes(key),
        ),
  );
}

function semanticEvidence(
  requirement: Requirement,
  observations: TestObservation[],
  nativeStatus: EvidenceStatus,
) {
  if (!requirement.expectation)
    return { status: "not-applicable" as const, issues: [] as string[] };
  const reference = requirement.acceptance?.test;
  const matches = reference
    ? observations.filter(
        ({ file, name }) => file === reference.file && name === reference.name,
      )
    : [];
  if (!matches.length)
    return {
      status: "not-run" as const,
      issues: ["Canonical semantic test has not executed"],
    };
  const issues = matches.flatMap(({ semanticReceipt }) =>
    validateSemanticReceipt(semanticReceipt, requirement),
  );
  if (nativeStatus !== "passed")
    issues.push("Canonical native execution did not pass");
  return {
    status: issues.length ? ("failed" as const) : ("passed" as const),
    issues: [...new Set(issues)],
    receipts: matches.map(({ project, semanticReceipt }) => ({
      project,
      receipt: semanticReceipt,
    })),
  };
}

export function buildEvidenceReport(
  files: SpecificationFile[],
  observations: TestObservation[] = [],
  executions: EvidenceExecution[] = [],
) {
  const requirements = files.flatMap(({ path, data }) =>
    collectRequirements(data).map((requirement) => {
      const test = requirement.acceptance?.test;
      const result = test ? matchTest(test, observations) : undefined;
      return {
        document: path,
        id: requirement.id,
        representation: requirement.expectation
          ? ("typed" as const)
          : ("prose" as const),
        status: result?.status ?? ("missing-tests" as EvidenceStatus),
        test: result,
        semantics: semanticEvidence(
          requirement,
          observations,
          result?.status ?? "missing-tests",
        ),
      };
    }),
  );
  const typedBindings = files
    .flatMap(({ data }) => collectRequirements(data))
    .filter((requirement) => requirement.expectation);
  const orphanSemanticObservations = observations
    .filter(
      (observation) =>
        observation.semanticReceipt !== undefined &&
        typedBindings.filter(
          (requirement) =>
            requirement.acceptance?.test.file === observation.file &&
            requirement.acceptance.test.name === observation.name,
        ).length !== 1,
    )
    .map(({ file, name }) => ({ file, name }));
  const unstructuredTextCandidates = files.flatMap(({ path, data }) =>
    residualTextLocations(data).map((location) => ({
      document: path,
      location,
    })),
  );
  const provenance = [
    ...new Map(
      observations
        .filter((test) => test.source)
        .map((test) => [JSON.stringify(test.source), test.source]),
    ).values(),
  ];
  const executionFailures = executions.filter(
    (execution) => execution.outcome !== "success",
  );
  const missingArtifacts = [...MANDATORY_EVIDENCE_ARTIFACTS.keys()].filter(
    (artifact) =>
      !executions.some((execution) => execution.artifact === artifact),
  );
  const counts = Object.fromEntries(
    precedence.map((status) => [
      status,
      requirements.filter((requirement) => requirement.status === status)
        .length,
    ]),
  );
  const typed = requirements.filter(
    (requirement) => requirement.representation === "typed",
  );
  return {
    evidenceMeaning:
      "Native statuses describe execution of bound tests. Semantic receipts additionally require successful comparisons for every typed field and the current expectation digest. These are not independent proof of product reasonableness; reviewers must assess the observations and requirements.",
    inventoryCompleteness:
      "Residual text candidates are locations for review, not a count of additional atomic requirements.",
    provenance,
    executions,
    executionFailures,
    missingArtifacts,
    orphanSemanticObservations,
    unstructuredTextCandidates,
    requirements,
    summary: {
      total: requirements.length,
      unsuccessfulExecutions: executionFailures.length,
      orphanSemanticObservations: orphanSemanticObservations.length,
      missingArtifacts: missingArtifacts.length,
      unstructuredTextCandidates: unstructuredTextCandidates.length,
      typedDeclarations: typed.length,
      proseRequirements: requirements.length - typed.length,
      semanticVerified: typed.filter(
        (requirement) => requirement.semantics.status === "passed",
      ).length,
      semanticFailed: typed.filter(
        (requirement) => requirement.semantics.status === "failed",
      ).length,
      semanticNotRun: typed.filter(
        (requirement) => requirement.semantics.status === "not-run",
      ).length,
      ...counts,
    },
    // Completeness applies to every requirement, regardless of its representation.
    gatePassed:
      executionFailures.length === 0 &&
      orphanSemanticObservations.length === 0 &&
      missingArtifacts.length === 0 &&
      requirements.length > 0 &&
      requirements.every(
        (requirement) =>
          requirement.status === "passed" &&
          ["passed", "not-applicable"].includes(requirement.semantics.status),
      ),
  };
}

const runIdentity = z.object({
  sha: nonempty,
  run: z.string().regex(/^[1-9][0-9]*$/),
  attempt: z.string().regex(/^[1-9][0-9]*$/),
});
const executionOutcome = z.enum(["success", "failure", "cancelled", "skipped"]);
const manifestSchema = runIdentity.extend({
  root: nonempty,
  outcome: executionOutcome,
  reports: z.array(
    z.object({ file: nonempty, runner: z.enum(["vitest", "playwright"]) }),
  ),
});
export function currentRunIdentity() {
  return runIdentity.parse({
    sha: process.env.GITHUB_SHA,
    run: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
  });
}
export function validateEvidenceManifest(
  value: unknown,
  expected: z.infer<typeof runIdentity>,
) {
  const manifest = manifestSchema.parse(value);
  for (const field of ["sha", "run", "attempt"] as const)
    if (manifest[field] !== expected[field])
      throw new Error(
        `Evidence ${field} does not match this workflow execution`,
      );
  if (!isAbsolute(manifest.root))
    throw new Error("Evidence repository root must be absolute");
  if (
    new Set(manifest.reports.map(({ file }) => file)).size !==
    manifest.reports.length
  )
    throw new Error("Duplicate native report in manifest");
  for (const { file, runner } of manifest.reports)
    if (!new RegExp(`^${runner}-[a-zA-Z0-9-]+\\.json$`).test(file))
      throw new Error(`Unsafe native report filename: ${file}`);
  return manifest;
}

/** Called in always() after each CI test job, before this run's artifact upload. */
export async function captureEvidence(
  directory: string,
  root = repositoryRoot,
) {
  await mkdir(directory, { recursive: true });
  const reports = (await readdir(directory)).sort().flatMap((file) => {
    const match = /^(vitest|playwright)-[a-zA-Z0-9-]+\.json$/.exec(file);
    return match ? [{ file, runner: match[1] as "vitest" | "playwright" }] : [];
  });
  const manifest = {
    ...currentRunIdentity(),
    root,
    outcome: executionOutcome.parse(process.env.SPEC_EVIDENCE_OUTCOME),
    reports,
  };
  await writeFile(
    join(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
export async function loadEvidence(
  directory: string,
  expected = currentRunIdentity(),
) {
  const observations: TestObservation[] = [];
  const executions: EvidenceExecution[] = [];
  // download-artifact keeps one directory per job artifact. No cross-run
  // artifact IDs, external URLs, or persisted evidence database are accepted.
  const artifacts = (await readdir(directory, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory(),
  );
  if (!artifacts.length)
    throw new Error("No workflow evidence artifacts downloaded");
  for (const artifact of artifacts) {
    const expectedRunner = MANDATORY_EVIDENCE_ARTIFACTS.get(artifact.name);
    if (!expectedRunner)
      throw new Error(
        `Unexpected workflow evidence artifact: ${artifact.name}`,
      );
    const base = join(directory, artifact.name);
    const manifest = validateEvidenceManifest(
      JSON.parse(await readFile(join(base, "manifest.json"), "utf8")),
      expected,
    );
    const execution: EvidenceExecution = {
      artifact: artifact.name,
      sha: manifest.sha,
      run: manifest.run,
      attempt: manifest.attempt,
      outcome: manifest.outcome,
    };
    executions.push(execution);
    let executedTests = 0;
    for (const report of manifest.reports) {
      if (report.runner !== expectedRunner)
        throw new Error(
          `Wrong native runner for ${artifact.name}: ${report.runner}`,
        );
      const parsed = parseNativeReport(
        JSON.parse(await readFile(join(base, report.file), "utf8")),
        report.runner,
        manifest.root,
      );
      executedTests += parsed.filter(
        (test) => test.status === "passed" || test.status === "failed",
      ).length;
      if (
        manifest.outcome === "success" &&
        parsed.some((test) => test.status === "failed")
      )
        throw new Error(
          `Successful artifact contains failed native tests: ${artifact.name}`,
        );
      observations.push(
        ...parsed.map((observation) => ({
          ...observation,
          source: {
            ...execution,
            report: report.file,
          },
        })),
      );
    }
    if (manifest.outcome === "success" && executedTests === 0)
      throw new Error(
        `Successful artifact has no executed native tests: ${artifact.name}`,
      );
  }
  return { observations, executions };
}

export async function runEvidenceCoverage(
  args: string[],
  root = repositoryRoot,
) {
  let results: string | undefined;
  let output: string | undefined;
  let enforce = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--enforce") enforce = true;
    else if (arg === "--results" || arg === "--output") {
      const value = args[++index];
      if (!value || value.startsWith("--"))
        throw new Error(`${arg} requires a path`);
      if (arg === "--results") results = value;
      else output = value;
    } else throw new Error(`Unknown evidence option: ${arg}`);
  }
  const validation = await checkSpecifications(root);
  if (enforce)
    validateMandatoryJobResults(
      JSON.parse(process.env.SPEC_EVIDENCE_NEEDS ?? "null"),
    );
  const evidence = results
    ? await loadEvidence(results)
    : { observations: [], executions: [] };
  const report = buildEvidenceReport(
    await readSpecifications(root),
    evidence.observations,
    evidence.executions,
  );
  const verifiedReport = { ...report, validation: validation.validation };
  const json = `${JSON.stringify(verifiedReport, null, 2)}\n`;
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, json);
    console.log(JSON.stringify(report.summary));
  } else process.stdout.write(json);
  if (enforce && !report.gatePassed)
    throw new Error(
      "Specification evidence gate failed; inspect missingArtifacts, executionFailures and requirement statuses in the report",
    );
  return verifiedReport;
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === "capture" && args.length === 1)
      await captureEvidence(args[0]);
    else if (command === "coverage") await runEvidenceCoverage(args);
    else
      throw new Error(
        "Usage: evidence.ts capture <directory> | coverage [--results directory] [--output file] [--enforce]",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
