import { readFileSync } from "node:fs";
import { parseSpecificationYaml } from "../../../scripts/specifications/yaml";

type UiExpectations = {
  target_size: {
    kind: "target_size";
    surface: "web";
    target: { by: "test_id" | "css"; value: string };
    viewport: { width: number; height: number };
    min_width: number;
    min_height: number;
  };
  ordered_items: {
    kind: "ordered_items";
    surface: "web";
    target: { by: "test_id" | "css"; value: string };
    items: string[];
  };
};
const source = new URL("../../../docs/policies/ui.yaml", import.meta.url);
const specification = parseSpecificationYaml(
  readFileSync(source, "utf8"),
  source.pathname,
) as {
  requirements: Array<{ id: string; expectation?: { kind: string } }>;
};

export function uiExpectation<K extends keyof UiExpectations>(
  id: string,
  kind: K,
): UiExpectations[K] {
  const expectation = specification.requirements.find(
    (item) => item.id === id,
  )?.expectation;
  if (!expectation || expectation.kind !== kind)
    throw new Error(`Missing ${kind} expectation ${id}`);
  return expectation as UiExpectations[K];
}
