import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { afterEach, describe, expect, it } from "vitest";
import {
  readSpecifications,
  type SpecificationFile,
} from "../../../scripts/specifications/repository";
import {
  declaredTestNames,
  validateSpecificationReferences,
  validateSpecificationShapes,
} from "../../../scripts/specifications/validate";

function feature(): SpecificationFile {
  return {
    path: "docs/features/example.yaml",
    data: {
      kind: "feature",
      id: "example",
      capabilities: { set: {} },
      requirements: [
        {
          id: "example.idempotency",
          category: "consistency",
          rule: "Repeated sets preserve state.",
          applies_to: ["set"],
          acceptance: [
            {
              id: "retry",
              given: "Already set",
              when: "Set again",
              then: ["State remains stable"],
            },
          ],
        },
      ],
    },
  };
}

describe("specification structure and references", () => {
  const directories: string[] = [];
  afterEach(async () => {
    await Promise.all(
      directories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("rejects unknown kinds and fields rather than discarding them", () => {
    const validators = new Map([
      [
        "feature",
        new Ajv2020().compile({
          type: "object",
          required: ["kind"],
          properties: { kind: { const: "feature" } },
          additionalProperties: false,
        }),
      ],
    ]);
    expect(
      validateSpecificationShapes([feature()], validators).join("\n"),
    ).toContain("additional properties");
    expect(
      validateSpecificationShapes(
        [{ path: "unknown.yaml", data: { kind: "typo" } }],
        validators,
      ).join("\n"),
    ).toContain("unsupported specification kind typo");
  });

  it("rejects duplicate requirement IDs and acceptance IDs", async () => {
    const file = feature();
    const requirements = file.data.requirements as Array<{
      acceptance: unknown[];
    }>;
    requirements[0].acceptance.push(requirements[0].acceptance[0]);
    requirements.push(requirements[0]);
    const result = await validateSpecificationReferences([file]);
    expect(result.errors.join("\n")).toContain(
      "duplicate requirement ID example.idempotency",
    );
    expect(result.errors.join("\n")).toContain("duplicate scenario retry");
  });

  it("rejects broken local capabilities, policies and cross-feature references", async () => {
    const file = feature();
    file.data.policy_refs = ["missing-policy"];
    file.data.refs = [
      { feature: "example", capability: "missing-capability" },
      { feature: "missing-feature" },
    ];
    (file.data.requirements as Array<{ applies_to: string[] }>)[0].applies_to =
      ["missing-local"];
    const result = await validateSpecificationReferences([file]);
    expect(result.errors.join("\n")).toContain("unknown policy missing-policy");
    expect(result.errors.join("\n")).toContain(
      "unknown capability missing-local",
    );
    expect(result.errors.join("\n")).toContain(
      "unknown capability example.missing-capability",
    );
    expect(result.errors.join("\n")).toContain(
      "unknown feature missing-feature",
    );
  });

  it("only treats enabled test declarations as valid links", () => {
    expect([
      ...declaredTestNames(`
      // it("comment", () => {});
      const unused = "string only";
      it("real test", () => {});
      test.each([1])("parameterized %s", () => {});
      test.skip("skipped", () => {});
      describe.skip("disabled group", () => { it("disabled child", () => {}); });
      other("not a test", () => {});
    `),
    ]).toEqual(["real test", "parameterized %s"]);
  });

  it("checks exact linked test names and reports unlinked scenarios honestly", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-references-"));
    directories.push(root);
    await mkdir(join(root, "tests"));
    await writeFile(
      join(root, "tests/behavior.test.ts"),
      'it("preserves state on retry", () => { expect(actual).toEqual(expected); });',
    );
    const file = feature();
    const scenario = (
      file.data.requirements as Array<{
        acceptance: Array<{ tests?: Array<{ file: string; name: string }> }>;
      }>
    )[0].acceptance[0];
    const unlinked = await validateSpecificationReferences([file], root);
    expect(unlinked).toMatchObject({
      errors: [],
      requirements: 1,
      scenarios: 1,
      linkedScenarios: 0,
    });
    scenario.tests = [
      { file: "tests/behavior.test.ts", name: "preserves state on retry" },
    ];
    expect(await validateSpecificationReferences([file], root)).toMatchObject({
      errors: [],
      linkedScenarios: 1,
    });
    scenario.tests[0].name = "nonexistent test";
    expect(
      (await validateSpecificationReferences([file], root)).errors.join("\n"),
    ).toContain("no enabled literal test");
  });

  it("does not silently ignore a reintroduced JSON specification", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-json-"));
    directories.push(root);
    await mkdir(join(root, "docs/features"), { recursive: true });
    await writeFile(join(root, "docs/features/example.json"), "{}");
    await expect(readSpecifications(root)).rejects.toThrow(
      "handwritten specifications must use YAML",
    );
  });
});
