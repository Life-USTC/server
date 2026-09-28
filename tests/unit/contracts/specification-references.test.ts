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

  it("rejects specifications misplaced outside their canonical directory", async () => {
    const file = feature();
    file.path = "docs/policies/archive/example.yaml";
    expect(
      (await validateSpecificationReferences([file])).errors.join("\n"),
    ).toContain("must be stored at docs/features/example.yaml");
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

  it("keeps acceptance scenarios independent of test declarations", async () => {
    const file = feature();
    expect(await validateSpecificationReferences([file])).toEqual({
      errors: [],
      requirements: 1,
    });
    const requirements = file.data.requirements as Array<
      Record<string, unknown>
    >;
    const acceptance = requirements[0].acceptance as Record<string, unknown>;
    // This is an editorial pointer. The checker must not read its test source,
    // require an identical title, or forbid several rules sharing a scenario.
    acceptance.test = {
      file: "tests/not-created.test.ts",
      name: "subscription lifecycle",
    };
    requirements.push({ ...requirements[0], id: "example.persistence" });
    expect(await validateSpecificationReferences([file])).toEqual({
      errors: [],
      requirements: 2,
    });
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
