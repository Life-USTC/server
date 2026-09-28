/** Mandatory CI producers. A workflow contract test checks every matrix partition. */
export const MANDATORY_EVIDENCE_JOBS = {
  "test-unit": { runner: "vitest", artifacts: ["spec-evidence-unit"] },
  "test-integration": {
    runner: "vitest",
    artifacts: [1, 2, 3, 4].map(
      (index) => `spec-evidence-life_ustc_integration_${index}`,
    ),
  },
  "test-rest": {
    runner: "playwright",
    artifacts: [1, 2].map((index) => `spec-evidence-life_ustc_rest_${index}`),
  },
  "test-rls": { runner: "vitest", artifacts: ["spec-evidence-life_ustc_rls"] },
  "test-e2e": {
    runner: "playwright",
    artifacts: [1, 2, 3, 4, 5, 6, 7, 8].map(
      (index) => `spec-evidence-life_ustc_e2e_${index}`,
    ),
  },
} as const;

export const MANDATORY_EVIDENCE_ARTIFACTS = new Map(
  Object.values(MANDATORY_EVIDENCE_JOBS).flatMap(({ runner, artifacts }) =>
    artifacts.map((artifact) => [artifact, runner] as const),
  ),
);

export const MANDATORY_CI_JOBS = [
  "check",
  "build-e2e-artifacts",
  "static-loader-image",
  ...Object.keys(MANDATORY_EVIDENCE_JOBS),
];

/** GitHub supplies needs independently of artifacts, even when setup/upload failed. */
export function validateMandatoryJobResults(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(
      "Mandatory CI needs results are required for evidence enforcement",
    );
  const needs = value as Record<string, { result?: unknown } | undefined>;
  const failures = MANDATORY_CI_JOBS.filter(
    (job) => needs[job]?.result !== "success",
  );
  if (failures.length)
    throw new Error(
      `Mandatory CI jobs did not succeed: ${failures.join(", ")}`,
    );
}
