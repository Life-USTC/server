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
  validateCanonicalTestOwnership,
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
          acceptance: {
            given: "Already set",
            when: "Set again",
            // biome-ignore lint/suspicious/noThenProperty: Acceptance results are a non-callable list.
            then: ["State remains stable"],
          },
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

  it("rejects duplicate requirement IDs", async () => {
    const file = feature();
    const requirements = file.data.requirements as Array<{
      acceptance: unknown;
    }>;
    requirements.push(requirements[0]);
    const result = await validateSpecificationReferences([file]);
    expect(result.errors.join("\n")).toContain(
      "duplicate requirement ID example.idempotency",
    );
  });

  it("rejects broken local capabilities, policies and cross-feature references", async () => {
    const file = feature();
    file.data.policy_refs = ["missing-policy"];
    file.data.capabilities = {
      set: { policy_refs: ["missing-capability-policy"] },
    };
    file.data.refs = [
      { feature: "example", capability: "missing-capability" },
      { feature: "missing-feature" },
    ];
    (file.data.requirements as Array<{ applies_to: string[] }>)[0].applies_to =
      ["missing-local"];
    const result = await validateSpecificationReferences([file]);
    expect(result.errors.join("\n")).toContain("unknown policy missing-policy");
    expect(result.errors.join("\n")).toContain(
      "unknown policy missing-capability-policy",
    );
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
      test.for([1])("repeated title", () => {});
      test.skip("skipped", () => {});
      describe.skip("disabled group", () => { it("disabled child", () => {}); });
      other("not a test", () => {});
      test.step("step only", () => {});
      it.extend("not a declaration", () => {});
    `),
    ]).toEqual(["real test"]);
  });

  it("rejects duplicate literal names even when they occur in different suites", () => {
    expect([
      ...declaredTestNames(`
      describe("first", () => { it("example.rule", () => {}); });
      describe("second", () => { it("example.rule", () => {}); });
    `),
    ]).toEqual([]);
  });

  it("checks the reverse mapping and rejects orphan and duplicate canonical tests", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-bijection-"));
    directories.push(root);
    await mkdir(join(root, "tests"));
    await writeFile(
      join(root, "tests/behavior.test.ts"),
      'it("example.idempotency", () => {});',
    );
    const file = feature();
    const requirement = (
      file.data.requirements as Array<{
        acceptance: { test?: { file: string; name: string } };
      }>
    )[0];
    requirement.acceptance.test = {
      file: "tests/behavior.test.ts",
      name: "example.idempotency",
    };
    expect(await validateCanonicalTestOwnership([file], root)).toEqual([]);
    await writeFile(
      join(root, "tests/duplicate.test.ts"),
      'it("example.idempotency", () => {}); it("example.removed", () => {});',
    );
    const errors = (await validateCanonicalTestOwnership([file], root)).join(
      "\n",
    );
    expect(errors).toContain("is not bound by its requirement");
    expect(errors).toContain("is also declared");
    expect(errors).toContain("has no requirement");
  });

  it("rejects specifications misplaced outside their canonical directory", async () => {
    const file = feature();
    file.path = "docs/policies/archive/example.yaml";
    expect(
      (await validateSpecificationReferences([file])).errors.join("\n"),
    ).toContain("must be stored at docs/features/example.yaml");
  });

  it("rejects expected-failure options, inherited disabled options and dynamic option objects", () => {
    expect([
      ...declaredTestNames(`
      test("expected failure", { fails: true }, () => {});
      test("legacy expected failure", () => {}, { fails: true });
      describe("expected failure suite", { fails: true }, () => { test("inherited failure", () => {}); });
      describe("skipped suite", { skip: true }, () => { test("inherited skip", () => {}); });
      test("dynamic", options, () => {});
      test("spread", { ...options }, () => {});
      test("computed", { [key]: true }, () => {});
      test("normal options", { timeout: 1000, fails: false }, () => {});
    `),
    ]).toEqual(["normal options"]);
  });

  it("requires policy requirement IDs to use their document prefix", async () => {
    const file = feature();
    file.path = "docs/policies/example.yaml";
    file.data.kind = "policy";
    (file.data.requirements as Array<{ id: string }>)[0].id = "unrelated.rule";
    expect(
      (await validateSpecificationReferences([file])).errors.join("\n"),
    ).toContain("must use its document prefix");
  });

  it("requires a unique test named after the requirement", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-references-"));
    directories.push(root);
    await mkdir(join(root, "tests"));
    await writeFile(
      join(root, "tests/behavior.test.ts"),
      'it("example.idempotency", () => { expect(actual).toEqual(expected); });',
    );
    const file = feature();
    const scenario = (
      file.data.requirements as Array<{
        acceptance: { test?: { file: string; name: string } };
      }>
    )[0].acceptance;
    const unlinked = await validateSpecificationReferences([file], root);
    expect(unlinked).toMatchObject({
      requirements: 1,
      scenarios: 1,
      linkedScenarios: 0,
    });
    expect(unlinked.errors.join("\n")).toContain(
      "acceptance requires exactly one test",
    );
    scenario.test = {
      file: "tests/behavior.test.ts",
      name: "example.idempotency",
    };
    expect(await validateSpecificationReferences([file], root)).toMatchObject({
      errors: [],
      linkedScenarios: 1,
    });
    scenario.test.name = "nonexistent test";
    expect(
      (await validateSpecificationReferences([file], root)).errors.join("\n"),
    ).toContain("canonical test name must equal its requirement ID");
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
