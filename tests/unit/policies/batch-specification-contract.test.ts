import { createRequire } from "node:module";
import { expect, test } from "vitest";
import { graphqlPersistedOperationRegistry } from "@/lib/graphql/operations";
import { graphqlSchema } from "@/lib/graphql/schema";
import { readSpecifications } from "../../../scripts/specifications/repository";
import {
  loadSpecificationValidators,
  validateSpecificationShapes,
} from "../../../scripts/specifications/validate";
import { readSpecification } from "../../../scripts/specifications/yaml";

const { isInputObjectType } = createRequire(import.meta.url)(
  "graphql",
) as typeof import("graphql");
function acceptsCollection(type: string): boolean {
  if (type.includes("[")) return true;
  const input = graphqlSchema.getType(type.replaceAll("!", ""));
  return (
    isInputObjectType(input) &&
    Object.values(input.getFields()).some((field) =>
      acceptsCollection(String(field.type)),
    )
  );
}

type BatchDocument = {
  capabilities: Array<{
    id: string;
    semantics: string;
    graphql: { status: string; field: string | null };
    batch_contract?: {
      inputs: Array<{
        surface: string;
        identifiers: string[];
        duplicates: string;
        max_items: number;
        limit_basis: string;
      }>;
      results: string;
      atomicity: string;
      invalid_targets: string;
      retry: {
        desired_state: string;
        response: string;
        after_uncertain_result: string;
      };
      requirement_refs: string[];
    };
  }>;
};

test("interface-hierarchy.canonical-actions-4", async () => {
  const path = "docs/reference/mutation-capabilities.yaml";
  const document = await readSpecification<BatchDocument>(path);
  const validators = await loadSpecificationValidators();
  const validate = (data: unknown) =>
    validateSpecificationShapes(
      [{ path, data: data as Record<string, unknown> }],
      validators,
    );
  expect(validate(document)).toEqual([]);
  const requirements = new Set(
    (await readSpecifications()).flatMap((file) =>
      ((file.data.requirements ?? []) as Array<{ id: string }>).map(
        (requirement) => requirement.id,
      ),
    ),
  );
  const batches = document.capabilities.filter(
    (capability) => capability.batch_contract,
  );
  expect(batches).toHaveLength(7);
  for (const capability of batches) {
    const contract = capability.batch_contract;
    if (!contract) throw new Error("Missing batch contract");
    expect(
      new Set(contract.inputs.map((input) => input.surface)).size,
      capability.id,
    ).toBe(contract.inputs.length);
    for (const id of contract.requirement_refs)
      expect(requirements.has(id), `${capability.id}: ${id}`).toBe(true);
    if (capability.graphql.status === "stable") {
      const operation = graphqlPersistedOperationRegistry.find(
        (operation) => operation.rootField === capability.graphql.field,
      );
      expect(
        operation?.variables.some((variable) =>
          acceptsCollection(variable.type),
        ),
        capability.id,
      ).toBe(true);
      expect(
        contract.inputs.some((input) => input.surface === "graphql"),
        capability.id,
      ).toBe(true);
    }
    // A vague prose note cannot replace the structured identifier, duplicate,
    // transaction, outcome or retry contract in a future edit.
    for (const key of [
      "inputs",
      "results",
      "atomicity",
      "invalid_targets",
      "retry",
      "requirement_refs",
    ]) {
      const malformed = structuredClone(document);
      const target = malformed.capabilities.find(
        (item) => item.id === capability.id,
      );
      if (!target?.batch_contract) throw new Error("Missing cloned contract");
      delete (target.batch_contract as Record<string, unknown>)[key];
      expect(
        validate(malformed).length,
        `${capability.id}: missing ${key}`,
      ).toBeGreaterThan(0);
    }
    const malformed = structuredClone(document);
    const target = malformed.capabilities.find(
      (item) => item.id === capability.id,
    );
    if (!target?.batch_contract) throw new Error("Missing cloned contract");
    target.batch_contract.inputs[0].duplicates =
      "whatever the implementation does";
    expect(validate(malformed).length).toBeGreaterThan(0);
  }
  const completion = batches.find(
    (item) => item.id === "workspace_homework_completions_set",
  )?.batch_contract;
  expect(completion).toMatchObject({
    results: "ordered_per_item",
    atomicity: "accepted_items_transaction",
  });
  const subscription = batches.find(
    (item) => item.id === "workspace_subscriptions_import",
  )?.batch_contract;
  expect(
    subscription?.inputs.map(({ surface, duplicates }) => ({
      surface,
      duplicates,
    })),
  ).toEqual([
    { surface: "rest", duplicates: "deduplicate_normalized" },
    { surface: "graphql", duplicates: "reject_normalized" },
    { surface: "mcp-native", duplicates: "deduplicate_normalized" },
  ]);
});
