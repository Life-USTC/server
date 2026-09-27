import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnySchema, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import ts from "typescript";
import {
  type Requirement,
  readSpecifications,
  type SpecificationFile,
} from "./repository";
import { repositoryRoot, resolveRepositoryFile } from "./yaml";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeOperation(operation: string): string {
  return operation.replace(/\[([^\]]+)\]/g, "{$1}");
}

function transportOperations(
  capability: Record<string, unknown>,
  surface: string,
): Set<string> {
  const binding = capability[surface];
  const operations = new Set<string>();
  if (!record(binding)) return operations;
  if (surface === "rest" && Array.isArray(binding.routes)) {
    for (const route of binding.routes) {
      if (record(route) && typeof route.path === "string")
        operations.add(
          normalizeOperation(`${route.method ?? "GET"} ${route.path}`),
        );
    }
  } else if (surface === "mcp" && Array.isArray(binding.tools)) {
    for (const tool of binding.tools) {
      if (record(tool) && typeof tool.name === "string")
        operations.add(tool.name);
    }
  } else if (surface === "graphql") {
    for (const key of ["queries", "mutations", "fields"]) {
      const fields = binding[key];
      if (!Array.isArray(fields)) continue;
      for (const field of fields) {
        if (record(field) && typeof field.name === "string") {
          operations.add(
            typeof field.parent === "string"
              ? `${field.parent}.${field.name}`
              : field.name,
          );
        }
      }
    }
  }
  return operations;
}

function validateExpectation(
  requirement: Requirement,
  capabilities: Record<string, unknown>,
): string[] {
  const value = requirement.expectation;
  if (!value) return [];
  const errors: string[] = [];
  const { kind } = value;
  if (kind === "numeric_input" || kind === "collection_input") {
    const minimum = Number(
      kind === "numeric_input" ? value.minimum : value.min_items,
    );
    const maximum = Number(
      kind === "numeric_input" ? value.maximum : value.max_items,
    );
    if (minimum > maximum) errors.push("minimum must not exceed maximum");
    if (
      typeof value.default === "number" &&
      (value.default < minimum || value.default > maximum)
    ) {
      errors.push("default must be within the declared bounds");
    }
    if (
      value.integer === true &&
      [minimum, maximum, value.default].some(
        (item) => typeof item === "number" && !Number.isInteger(item),
      )
    ) {
      errors.push("integer constraints require integer bounds and defaults");
    }
  }
  if (kind === "authorization" && Array.isArray(value.cases)) {
    const ids = new Set<string>();
    for (const entry of value.cases) {
      if (!record(entry) || typeof entry.id !== "string") continue;
      if (ids.has(entry.id))
        errors.push(`duplicate authorization case ${entry.id}`);
      ids.add(entry.id);
    }
  }
  if (
    kind === "state_visibility" &&
    Array.isArray(value.visible) &&
    Array.isArray(value.hidden)
  ) {
    for (const target of value.visible) {
      if (value.hidden.includes(target))
        errors.push(`${String(target)} cannot be both visible and hidden`);
    }
    if (Array.isArray(value.restore_on_incomplete)) {
      for (const target of value.restore_on_incomplete) {
        if (!value.hidden.includes(target))
          errors.push(
            `${String(target)} must be hidden before it can be restored`,
          );
      }
    }
  }
  if (
    typeof value.operation === "string" &&
    typeof value.surface === "string" &&
    ["rest", "graphql", "mcp"].includes(value.surface)
  ) {
    const operations = new Set(
      (requirement.applies_to ?? []).flatMap((id) => {
        const capability = capabilities[id];
        return record(capability)
          ? [...transportOperations(capability, value.surface as string)]
          : [];
      }),
    );
    if (!operations.has(normalizeOperation(value.operation))) {
      errors.push(
        `operation ${value.operation} is not declared on the applicable ${value.surface} capability`,
      );
    }
  }
  return errors;
}

export function collectRequirements(value: unknown): Requirement[] {
  if (Array.isArray(value)) return value.flatMap(collectRequirements);
  if (!record(value)) return [];
  return Object.entries(value).flatMap(([key, item]) =>
    key === "requirements" && Array.isArray(item)
      ? (item as Requirement[])
      : collectRequirements(item),
  );
}

export async function loadSpecificationValidators(root = repositoryRoot) {
  const directory = join(root, "docs/schemas");
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schemas: Record<string, unknown>[] = [];
  for (const filename of (await readdir(directory))
    .filter((file) => file.endsWith(".schema.json"))
    .sort()) {
    const schema = JSON.parse(
      await readFile(join(directory, filename), "utf8"),
    );
    if (!record(schema) || typeof schema.$id !== "string") {
      throw new Error(`${filename}: schema requires an explicit $id`);
    }
    ajv.addSchema(schema as AnySchema);
    schemas.push(schema);
  }
  const validators = new Map<string, ValidateFunction>();
  for (const schema of schemas) {
    const properties = schema.properties;
    const kind = record(properties) ? properties.kind : undefined;
    if (!record(kind) || typeof kind.const !== "string") continue;
    if (validators.has(kind.const))
      throw new Error(`Duplicate schema for kind ${kind.const}`);
    const validator = ajv.getSchema(String(schema.$id));
    if (!validator) throw new Error(`Cannot compile schema ${schema.$id}`);
    validators.set(kind.const, validator);
  }
  return validators;
}

export function validateSpecificationShapes(
  files: SpecificationFile[],
  validators: Map<string, ValidateFunction>,
): string[] {
  const errors: string[] = [];
  for (const { path, data } of files) {
    const validator = validators.get(String(data.kind));
    if (!validator) {
      errors.push(
        `${path}: unsupported specification kind ${String(data.kind)}`,
      );
      continue;
    }
    if (!validator(data)) {
      for (const error of validator.errors ?? []) {
        errors.push(
          `${path}${error.instancePath}: ${error.message}${error.params.additionalProperty ? ` (${error.params.additionalProperty})` : ""}`,
        );
      }
    }
  }
  return errors;
}

function callParts(expression: ts.Expression): string[] {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression))
    return [...callParts(expression.expression), expression.name.text];
  if (ts.isCallExpression(expression)) return callParts(expression.expression);
  return [];
}

/** Literal test declarations only: comments or unrelated strings are not evidence. */
export function declaredTestNames(text: string): Set<string> {
  const source = ts.createSourceFile(
    "test.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const names = new Set<string>();
  function unsafeOptions(node: ts.CallExpression): boolean {
    // A callback plus dynamic/spread options cannot establish an enabled test.
    // Both current (name, options, fn) and older (name, fn, options) orderings
    // can hide expected-failure or skip flags from property-access inspection.
    if (node.arguments.length < 3) return false;
    const options =
      ts.isArrowFunction(node.arguments[1]) ||
      ts.isFunctionExpression(node.arguments[1])
        ? node.arguments[2]
        : node.arguments[1];
    if (!ts.isObjectLiteralExpression(options)) return true;
    for (const property of options.properties) {
      if (!ts.isPropertyAssignment(property)) return true;
      if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
        return true;
      const key = property.name.text;
      if (
        ["fails", "skip", "todo"].includes(key) &&
        property.initializer.kind !== ts.SyntaxKind.FalseKeyword
      )
        return true;
      if (["skipIf", "runIf"].includes(key)) return true;
    }
    return false;
  }
  function walk(node: ts.Node, disabled: boolean) {
    if (ts.isCallExpression(node)) {
      const parts = callParts(node.expression);
      const isTest = ["test", "it", "describe"].includes(parts[0]);
      disabled ||=
        isTest &&
        (parts.some((part) =>
          ["skip", "todo", "fails", "skipIf", "runIf"].includes(part),
        ) ||
          unsafeOptions(node));
      const first = node.arguments[0];
      if (
        !disabled &&
        ["test", "it"].includes(parts[0]) &&
        parts
          .slice(1)
          .every((part) =>
            ["only", "each", "for", "concurrent", "sequential"].includes(part),
          ) &&
        node.arguments.length >= 2 &&
        first &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
      ) {
        names.add(first.text);
      }
    }
    ts.forEachChild(node, (child) => walk(child, disabled));
  }
  walk(source, false);
  return names;
}

export async function validateSpecificationReferences(
  files: SpecificationFile[],
  root = repositoryRoot,
): Promise<{
  errors: string[];
  requirements: number;
  scenarios: number;
  linkedScenarios: number;
}> {
  const errors: string[] = [];
  const documentIds = new Set<string>();
  const requirementIds = new Set<string>();
  const knownRequirementIds = new Set(
    files.flatMap(({ data }) => collectRequirements(data).map(({ id }) => id)),
  );
  const policies = new Set(
    files
      .filter(({ data }) => data.kind === "policy")
      .map(({ data }) => data.id),
  );
  const features = new Map(
    files
      .filter(({ data }) => data.kind === "feature")
      .map(({ data }) => [data.id, data]),
  );
  const testNames = new Map<string, Set<string>>();
  let requirements = 0;
  let scenarios = 0;
  let linkedScenarios = 0;
  for (const { path, data } of files) {
    const documentId = `${data.kind}:${data.id}`;
    if (documentIds.has(documentId))
      errors.push(`${path}: duplicate document ID ${documentId}`);
    documentIds.add(documentId);
    const directories: Record<string, string> = {
      feature: "features",
      policy: "policies",
      decision: "decisions",
      "mutation-capabilities": "reference",
    };
    const directory = directories[String(data.kind)];
    const expectedPath =
      data.kind === "product"
        ? "docs/product.yaml"
        : directory
          ? `docs/${directory}/${data.id}.yaml`
          : undefined;
    if (expectedPath && path !== expectedPath) {
      errors.push(
        `${path}: ${String(data.kind)} ${String(data.id)} must be stored at ${expectedPath}`,
      );
    }
    const capabilities = record(data.capabilities) ? data.capabilities : {};
    const topicIds = new Set<string>();
    if (Array.isArray(data.topics)) {
      for (const topic of data.topics) {
        if (!record(topic) || typeof topic.id !== "string") continue;
        if (topicIds.has(topic.id))
          errors.push(`${path}: duplicate topic ${topic.id}`);
        topicIds.add(topic.id);
      }
    }
    for (const requirement of collectRequirements(data)) {
      requirements += 1;
      if (requirementIds.has(requirement.id))
        errors.push(`${path}: duplicate requirement ID ${requirement.id}`);
      requirementIds.add(requirement.id);
      for (const error of validateExpectation(requirement, capabilities)) {
        errors.push(`${path}: ${requirement.id}: ${error}`);
      }
      if (requirement.topic && !topicIds.has(requirement.topic)) {
        errors.push(
          `${path}: ${requirement.id} references unknown topic ${requirement.topic}`,
        );
      }
      if (data.kind === "feature" || data.kind === "policy") {
        if (!requirement.id.startsWith(`${data.id}.`))
          errors.push(
            `${path}: requirement ${requirement.id} must use its document prefix`,
          );
      }
      if (data.kind === "feature") {
        for (const capability of requirement.applies_to ?? []) {
          if (!Object.hasOwn(capabilities, capability))
            errors.push(
              `${path}: ${requirement.id} references unknown capability ${capability}`,
            );
        }
      }
      const scenarioIds = new Set<string>();
      for (const scenario of requirement.acceptance ?? []) {
        scenarios += 1;
        if (scenarioIds.has(scenario.id))
          errors.push(
            `${path}: ${requirement.id} has duplicate scenario ${scenario.id}`,
          );
        scenarioIds.add(scenario.id);
        if (scenario.tests?.length) linkedScenarios += 1;
        for (const test of scenario.tests ?? []) {
          try {
            if (
              !test.file.startsWith("tests/") ||
              test.file.split("/").includes("..") ||
              !/(?:\.test|\/test)\.ts$/.test(test.file)
            ) {
              throw new Error(
                "test reference must point to a TypeScript test under tests/",
              );
            }
            const filename = await resolveRepositoryFile(root, test.file);
            if (!testNames.has(filename))
              testNames.set(
                filename,
                declaredTestNames(await readFile(filename, "utf8")),
              );
            if (!testNames.get(filename)?.has(test.name))
              throw new Error(
                `no enabled literal test named ${JSON.stringify(test.name)}`,
              );
          } catch (error) {
            errors.push(
              `${path}: ${requirement.id}/${scenario.id}: ${test.file}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }
    // Policy and decision references use the same feature/capability identity.
    function checkReferences(value: unknown) {
      if (Array.isArray(value)) {
        value.forEach(checkReferences);
      } else if (record(value)) {
        if (Array.isArray(value.requirement_refs)) {
          for (const id of value.requirement_refs) {
            if (!knownRequirementIds.has(String(id)))
              errors.push(`${path}: unknown requirement ${String(id)}`);
          }
        }
        if (Array.isArray(value.policy_refs)) {
          for (const policy of value.policy_refs) {
            if (!policies.has(policy))
              errors.push(`${path}: unknown policy ${String(policy)}`);
          }
        }
        if (typeof value.feature === "string") {
          const feature = features.get(value.feature);
          if (!feature)
            errors.push(`${path}: unknown feature ${value.feature}`);
          else if (
            typeof value.capability === "string" &&
            (!record(feature.capabilities) ||
              !Object.hasOwn(feature.capabilities, value.capability))
          ) {
            errors.push(
              `${path}: unknown capability ${value.feature}.${value.capability}`,
            );
          }
        }
        Object.values(value).forEach(checkReferences);
      }
    }
    checkReferences(data);
  }
  return { errors, requirements, scenarios, linkedScenarios };
}

export async function checkSpecifications(root = repositoryRoot) {
  const [files, validators] = await Promise.all([
    readSpecifications(root),
    loadSpecificationValidators(root),
  ]);
  if (!files.length) throw new Error("No YAML specifications found");
  const shapeErrors = validateSpecificationShapes(files, validators);
  if (shapeErrors.length) throw new Error(shapeErrors.join("\n"));
  const references = await validateSpecificationReferences(files, root);
  if (references.errors.length) throw new Error(references.errors.join("\n"));
  return { files: files.length, ...references };
}
