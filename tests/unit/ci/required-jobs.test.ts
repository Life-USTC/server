import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
const gate = workflow.jobs["specification-evidence"];
const command = gate.steps[0].run;
const successful = Object.fromEntries(
  gate.needs.map((name: string) => [name, { result: "success" }]),
);
function runGate(results: unknown) {
  execFileSync("bash", ["-euo", "pipefail", "-c", command], {
    env: { ...process.env, JOB_RESULTS: JSON.stringify(results) },
    stdio: "pipe",
  });
}

describe("mandatory CI gate", () => {
  it("waits for every mandatory job even after a dependency fails", () => {
    const mandatory = Object.keys(workflow.jobs).filter(
      (name) =>
        name !== "specification-evidence" && name !== "test-visual-regression",
    );
    expect(gate.needs.toSorted()).toEqual(mandatory.toSorted());
    expect(gate.if).toBe("$" + "{{ always() }}");
  });

  it("accepts successful execution", () => {
    expect(() => runGate(successful)).not.toThrow();
  });

  it.each(["failure", "cancelled", "skipped", undefined])(
    "rejects a %s outcome from any mandatory job",
    (result) => {
      for (const name of gate.needs) {
        expect(() => runGate({ ...successful, [name]: { result } })).toThrow();
      }
    },
  );

  it("rejects a missing result from any required job group", () => {
    for (const name of gate.needs) {
      const results = { ...successful };
      delete results[name];
      expect(() => runGate(results)).toThrow();
    }
  });

  it("rejects empty or malformed results", () => {
    for (const value of [{}, [], null, "success"]) {
      expect(() => runGate(value)).toThrow();
    }
  });
});
