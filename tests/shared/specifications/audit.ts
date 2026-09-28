import { readFileSync } from "node:fs";
import { parseSpecificationYaml } from "../../../scripts/specifications/yaml";

export type RetentionExpectation = {
  kind: "retention";
  operation: "maintain_audit_log_retention";
  network_days: number;
  attribution_days: number;
  event_days: number;
  boundary: "inclusive";
};
const source = new URL("../../../docs/policies/audit.yaml", import.meta.url);
const specification = parseSpecificationYaml(
  readFileSync(source, "utf8"),
  source.pathname,
) as {
  requirements: Array<{ id: string; expectation?: RetentionExpectation }>;
};
export function auditRetentionExpectation() {
  const expectation = specification.requirements.find(
    (r) => r.id === "audit.writer-4",
  )?.expectation;
  if (expectation?.kind !== "retention")
    throw new Error("Missing typed audit retention expectation");
  return expectation;
}
