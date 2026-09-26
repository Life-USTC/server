import { describe, expect, it } from "vitest";
import {
  checkSpecifications,
  loadSpecificationValidators,
  validateSpecificationShapes,
} from "../../../scripts/specifications/validate";
import { readSpecification } from "../../../scripts/specifications/yaml";

describe("versioned YAML product specifications", () => {
  it("validates every source against its schema and checks references", async () => {
    const result = await checkSpecifications();
    expect(result.files).toBeGreaterThan(0);
    expect(result.requirements).toBeGreaterThan(0);
    expect(result.scenarios).toBeGreaterThan(0);
    expect(result.linkedScenarios).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });

  it("rejects unknown feature fields and reintroduced handwritten wire types", async () => {
    const validators = await loadSpecificationValidators();
    const data = await readSpecification<Record<string, unknown>>(
      "docs/features/course.yaml",
    );
    data.accidental_field = true;
    expect(
      validateSpecificationShapes(
        [{ path: "docs/features/course.yaml", data }],
        validators,
      ).join("\n"),
    ).toContain("accidental_field");
    delete data.accidental_field;
    const capabilities = data.capabilities as Record<
      string,
      { rest?: { routes: Array<Record<string, unknown>> } }
    >;
    const route = Object.values(capabilities).find(
      (capability) => capability.rest?.routes.length,
    )?.rest?.routes[0];
    expect(route).toBeDefined();
    if (!route) throw new Error("Expected a course REST binding");
    route.returns = "A handwritten duplicate wire type";
    expect(
      validateSpecificationShapes(
        [{ path: "docs/features/course.yaml", data }],
        validators,
      ).join("\n"),
    ).toContain("returns");
  });

  it("allows a design decision without field mappings while rejecting undeclared fields", async () => {
    const validators = await loadSpecificationValidators();
    const data = {
      kind: "decision",
      id: "example-decision",
      title: "A decision without a storage change",
      date: "2026-09-02",
      status: "accepted",
      refs: [{ feature: "homework" }],
      context: ["Separate ordinary ownership from moderation."],
      decisions: ["Use explicit governance entry points."],
      consequences: [
        "Ordinary clients do not inherit administrator deletion powers.",
      ],
    };
    expect(
      validateSpecificationShapes(
        [{ path: "docs/decisions/example-decision.yaml", data }],
        validators,
      ),
    ).toEqual([]);
    expect(
      validateSpecificationShapes(
        [
          {
            path: "docs/decisions/example-decision.yaml",
            data: { ...data, unexpected: true },
          },
        ],
        validators,
      ).join("\n"),
    ).toContain("unexpected");
  });
});
