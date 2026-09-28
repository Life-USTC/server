/** Aggregate native CI outcomes only; requirement coverage is reviewed manually. */
export const REQUIRED_JOBS = [
  "check",
  "build-e2e-artifacts",
  "static-loader-image",
  "test-unit",
  "test-integration",
  "test-rest",
  "test-rls",
  "test-e2e",
] as const;

export function assertRequiredJobs(results: unknown): void {
  if (!results || typeof results !== "object" || Array.isArray(results)) {
    throw new Error("Expected native CI needs results");
  }
  const jobs = results as Record<string, { result?: unknown } | null>;
  const incomplete = REQUIRED_JOBS.filter(
    (job) => jobs[job]?.result !== "success",
  );
  if (incomplete.length) {
    throw new Error(
      `Mandatory CI jobs did not succeed: ${incomplete.join(", ")}`,
    );
  }
}

if (import.meta.main) {
  assertRequiredJobs(JSON.parse(process.env.REQUIRED_JOB_RESULTS ?? "null"));
  console.log(
    "All mandatory native CI jobs succeeded. Requirement coverage is maintained by human review.",
  );
}
