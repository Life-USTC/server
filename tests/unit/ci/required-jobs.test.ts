import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parse } from "yaml";

it("includes every mandatory job in the aggregate gate", () => {
  const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
  const gate = workflow.jobs["specification-evidence"];
  const mandatory = Object.keys(workflow.jobs).filter(
    (name) => name !== "specification-evidence",
  );
  expect(gate.needs.toSorted()).toEqual(mandatory.toSorted());
  expect(gate.if).toBe("$" + "{{ always() }}");
});
