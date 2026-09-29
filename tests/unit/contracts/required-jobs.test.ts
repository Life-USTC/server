import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { assertRequiredJobs, REQUIRED_JOBS } from "../../ci/required-jobs";

const successfulResults = () =>
  Object.fromEntries(REQUIRED_JOBS.map((job) => [job, { result: "success" }]));

describe("required native CI job aggregation", () => {
  it("accepts successful execution without any specification/test mapping", () => {
    expect(() => assertRequiredJobs(successfulResults())).not.toThrow();
  });

  it.each(["failure", "cancelled", "skipped", undefined])(
    "rejects a %s outcome from every mandatory job",
    (result) => {
      for (const job of REQUIRED_JOBS) {
        expect(() =>
          assertRequiredJobs({ ...successfulResults(), [job]: { result } }),
        ).toThrow(job);
      }
    },
  );

  it("rejects omitted jobs and malformed input", () => {
    for (const job of REQUIRED_JOBS) {
      const results = successfulResults();
      delete results[job];
      expect(() => assertRequiredJobs(results)).toThrow(job);
    }
    for (const input of [null, [], "success", {}]) {
      expect(() => assertRequiredJobs(input)).toThrow();
    }
  });

  it("runs the protected aggregate gate after every mandatory native job", () => {
    const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
    const gate = workflow.jobs["specification-evidence"];
    expect(gate.name).toBe("Specification execution evidence");
    expect(gate.if).toBe("$" + "{{ always() }}");
    expect(gate.needs.toSorted()).toEqual([...REQUIRED_JOBS].sort());
    expect(gate.with["required-job-results"]).toBe("$" + "{{ toJSON(needs) }}");
    for (const job of REQUIRED_JOBS) expect(workflow.jobs[job]).toBeDefined();
    const reusable = parse(
      readFileSync(".github/workflows/bun-job.yml", "utf8"),
    );
    const phase = reusable.jobs.run.steps.find(
      (step: { id?: string }) => step.id === "run-phase",
    );
    expect(phase.env.REQUIRED_JOB_RESULTS).toBe(
      "$" + "{{ inputs.required-job-results }}",
    );
    expect(phase.run).toContain("bun run tests/ci/required-jobs.ts");
  });
});
