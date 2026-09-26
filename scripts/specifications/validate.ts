import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
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
  function walk(node: ts.Node, disabled: boolean) {
    if (ts.isCallExpression(node)) {
      const parts = callParts(node.expression);
      const isTest = ["test", "it", "describe"].includes(parts[0]);
      disabled ||=
        isTest &&
        parts.some((part) =>
          ["skip", "todo", "fails", "skipIf", "runIf"].includes(part),
        );
      const first = node.arguments[0];
      if (
        !disabled &&
        ["test", "it"].includes(parts[0]) &&
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
    if (data.kind !== "product" && basename(path, ".yaml") !== data.id) {
      errors.push(
        `${path}: filename must match document ID ${String(data.id)}`,
      );
    }
    const capabilities = record(data.capabilities) ? data.capabilities : {};
    if (Array.isArray(data.policy_refs)) {
      for (const policy of data.policy_refs) {
        if (!policies.has(policy))
          errors.push(`${path}: unknown policy ${String(policy)}`);
      }
    }
    for (const requirement of collectRequirements(data)) {
      requirements += 1;
      if (requirementIds.has(requirement.id))
        errors.push(`${path}: duplicate requirement ID ${requirement.id}`);
      requirementIds.add(requirement.id);
      if (data.kind === "feature") {
        if (!requirement.id.startsWith(`${data.id}.`))
          errors.push(
            `${path}: requirement ${requirement.id} must use its feature prefix`,
          );
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
