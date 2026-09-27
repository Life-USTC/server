import { expect, it } from "vitest";
import type { SpecificationFile } from "../../../scripts/specifications/repository";
import {
  loadSpecificationValidators,
  validateSpecificationShapes,
} from "../../../scripts/specifications/validate";
import { auditRetentionExpectation } from "../../shared/specifications/audit";

it("validates typed retention boundaries and rejects incomplete or nonnumeric limits", async () => {
  const validators = await loadSpecificationValidators();
  const baseline = auditRetentionExpectation();
  function validate(expectation: Record<string, unknown>) {
    const file: SpecificationFile = {
      path: "docs/policies/audit.yaml",
      data: {
        kind: "policy",
        id: "audit",
        title: "Audit retention",
        topics: [{ id: "writer", title: "Writer" }],
        requirements: [
          {
            id: "audit.writer-4",
            category: "privacy",
            applies_to: ["writer"],
            expectation,
            acceptance: {
              given: "Stored audit rows",
              when: "Maintenance executes",
              // biome-ignore lint/suspicious/noThenProperty: Specification data.
              then: ["Expired fields are removed"],
              test: {
                file: "tests/integration/audit-policy-retention.test.ts",
                name: "audit.writer-4",
              },
            },
          },
        ],
      },
    };
    return validateSpecificationShapes([file], validators);
  }
  expect(validate(baseline)).toEqual([]);
  for (const property of [
    "network_days",
    "attribution_days",
    "event_days",
  ] as const) {
    const missing = { ...baseline } as Record<string, unknown>;
    delete missing[property];
    expect(validate(missing)).not.toEqual([]);
    for (const invalid of [0, -1, 0.5, "30", null])
      expect(validate({ ...baseline, [property]: invalid })).not.toEqual([]);
  }
  expect(validate({ ...baseline, boundary: "exclusive" })).not.toEqual([]);
  expect(validate({ ...baseline, unknown: true })).not.toEqual([]);
  expect(validate({ ...baseline, operation: "delete_everything" })).not.toEqual(
    [],
  );
});
