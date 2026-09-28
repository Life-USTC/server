import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnySchema, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import ts from "typescript";
import {
  isDomainExpectationKind,
  validateDomainExpectation,
} from "./domain-semantics";
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
  if (
    kind === "rate_limit_budget" &&
    Number(value.batch_limit) > Number(value.standard_limit)
  ) {
    errors.push("batch rate limit must not exceed the standard rate limit");
  }
  if (
    kind === "enum_input" &&
    Array.isArray(value.values) &&
    !value.values.includes(value.default)
  ) {
    errors.push("enum default must be one of its declared values");
  }
  if (
    kind === "string_input" &&
    Number(value.min_length) > Number(value.max_length)
  ) {
    errors.push("minimum string length must not exceed maximum");
  }
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
    if (record(data.capabilities)) {
      for (const [capabilityId, capability] of Object.entries(
        data.capabilities,
      )) {
        if (!record(capability) || !record(capability.presentation)) continue;
        const views = capability.presentation.views;
        if (!record(views)) continue;
        for (const [viewId, view] of Object.entries(views)) {
          if (!record(view)) continue;
          const seen = new Set<string>();
          for (const group of ["primary", "secondary", "tertiary"]) {
            if (!Array.isArray(view[group])) continue;
            for (const field of view[group]) {
              if (typeof field !== "string") continue;
              if (seen.has(field))
                errors.push(
                  `${path}/capabilities/${capabilityId}/presentation/views/${viewId}: ${field} belongs to more than one priority group`,
                );
              seen.add(field);
            }
          }
        }
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
  const duplicates = new Set<string>();
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
    // Canonical tests must be registered once, unconditionally. A literal title
    // inside a loop, conditional or arbitrary callback is not a unique test.
    disabled ||=
      ts.isIterationStatement(node, false) ||
      ts.isIfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isConditionalExpression(node) ||
      (ts.isBinaryExpression(node) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind));
    if (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isFunctionDeclaration(node)
    ) {
      const parent = node.parent;
      const parts = ts.isCallExpression(parent)
        ? callParts(parent.expression)
        : [];
      const suiteParts =
        parts[0] === "describe"
          ? parts.slice(1)
          : parts[0] === "test" && parts[1] === "describe"
            ? parts.slice(2)
            : undefined;
      disabled ||= !suiteParts?.every((part) =>
        ["only", "concurrent", "sequential", "serial", "parallel"].includes(
          part,
        ),
      );
    }
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
            ["only", "concurrent", "sequential"].includes(part),
          ) &&
        node.arguments.length >= 2 &&
        first &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
      ) {
        if (names.has(first.text)) duplicates.add(first.text);
        names.add(first.text);
      }
    }
    ts.forEachChild(node, (child) => walk(child, disabled));
  }
  walk(source, false);
  for (const name of duplicates) names.delete(name);
  return names;
}

export async function validateSpecificationReferences(
  files: SpecificationFile[],
  root = repositoryRoot,
  testNames = new Map<string, Set<string>>(),
): Promise<{
  errors: string[];
  requirements: number;
  boundRequirements: number;
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
  const testOwners = new Map<string, string>();
  let requirements = 0;
  let boundRequirements = 0;
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
      if (data.kind === "policy") {
        for (const topic of requirement.applies_to ?? []) {
          if (!topicIds.has(topic))
            errors.push(
              `${path}: ${requirement.id} applies to unknown policy topic ${topic}`,
            );
        }
      }
      const acceptance = requirement.acceptance;
      if (!acceptance) continue;
      const test = acceptance.test;
      if (!test) {
        errors.push(
          `${path}: ${requirement.id}: acceptance requires exactly one test`,
        );
        continue;
      }
      boundRequirements += 1;
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
        if (test.name !== requirement.id) {
          throw new Error("canonical test name must equal its requirement ID");
        }
        const filename = await resolveRepositoryFile(root, test.file);
        const identity = `${filename}\0${test.name}`;
        const owner = testOwners.get(identity);
        if (owner) {
          throw new Error(
            `test already belongs to ${owner}; one test cannot verify multiple requirements`,
          );
        }
        testOwners.set(identity, requirement.id);
        if (!testNames.has(filename))
          testNames.set(
            filename,
            declaredTestNames(await readFile(filename, "utf8")),
          );
        if (!testNames.get(filename)?.has(test.name))
          throw new Error(
            `no unique enabled literal test named ${JSON.stringify(test.name)}`,
          );
      } catch (error) {
        errors.push(
          `${path}: ${requirement.id}: ${test.file}: ${error instanceof Error ? error.message : String(error)}`,
        );
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
  return { errors, requirements, boundRequirements };
}

/** Stable requirement IDs form the namespace for canonical acceptance tests. */
export async function validateCanonicalTestOwnership(
  files: SpecificationFile[],
  root = repositoryRoot,
  testNames = new Map<string, Set<string>>(),
): Promise<string[]> {
  const errors: string[] = [];
  const owners = new Map(
    files.flatMap(({ data }) =>
      collectRequirements(data).map(
        (requirement) => [requirement.id, requirement] as const,
      ),
    ),
  );
  const prefixes = files
    .filter(({ data }) => data.kind === "feature" || data.kind === "policy")
    .map(({ data }) => `${String(data.id)}.`);
  const seen = new Map<string, string>();
  async function walk(directory: string) {
    for (const entry of await readdir(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (/(?:\.test|\/test)\.ts$/.test(path)) {
        const filename = await resolveRepositoryFile(root, path);
        let names = testNames.get(filename);
        if (!names) {
          names = declaredTestNames(await readFile(filename, "utf8"));
          testNames.set(filename, names);
        }
        for (const name of names) {
          if (
            !prefixes.some((prefix) => name.startsWith(prefix)) ||
            !/^[a-z0-9.-]+$/.test(name)
          )
            continue;
          const owner = owners.get(name);
          if (!owner)
            errors.push(`${path}: canonical test ${name} has no requirement`);
          else if (owner.acceptance?.test.file !== path)
            errors.push(
              `${path}: canonical test ${name} is not bound by its requirement`,
            );
          if (seen.has(name))
            errors.push(
              `${path}: canonical test ${name} is also declared in ${seen.get(name)}`,
            );
          seen.set(name, path);
        }
      }
    }
  }
  await walk("tests");
  return errors;
}

export async function checkSpecifications(
  root = repositoryRoot,
  complete = false,
) {
  const [files, validators] = await Promise.all([
    readSpecifications(root),
    loadSpecificationValidators(root),
  ]);
  if (!files.length) throw new Error("No YAML specifications found");
  const shapeErrors = validateSpecificationShapes(files, validators);
  if (shapeErrors.length) throw new Error(shapeErrors.join("\n"));
  // Share parsed declarations only within this check. Subsequent checks must
  // reread the filesystem so edits and newly disabled tests cannot be hidden.
  const testNames = new Map<string, Set<string>>();
  const references = await validateSpecificationReferences(
    files,
    root,
    testNames,
  );
  const typed = files
    .flatMap(({ data }) => collectRequirements(data))
    .filter(
      (
        r,
      ): r is Requirement & {
        expectation: NonNullable<Requirement["expectation"]>;
      } => Boolean(r.expectation),
    );
  const domainRequirements = typed.filter((r) =>
    isDomainExpectationKind(r.expectation.kind),
  );
  const requirementCapabilities = new Map(
    files.flatMap(({ data }) =>
      collectRequirements(data).map(
        (r) =>
          [r.id, record(data.capabilities) ? data.capabilities : {}] as const,
      ),
    ),
  );
  const domainReferences: {
    requirement: string;
    validatedPaths: string[];
    bindingPaths: string[];
  }[] = [];
  const domainErrors: string[] = [];
  if (domainRequirements.length) {
    const needsWire = domainRequirements.some((r) =>
      ["public_projection", "attachment_download_authority"].includes(
        r.expectation.kind,
      ),
    );
    const needsModel = domainRequirements.some(
      (r) => r.expectation.kind === "ordered_page",
    );
    const openapi = needsWire
      ? JSON.parse(
          await readFile(join(root, "public/openapi.generated.json"), "utf8"),
        )
      : undefined;
    const models = new Map<string, ReadonlySet<string>>();
    if (needsModel) {
      const prisma = await readFile(join(root, "prisma/schema.prisma"), "utf8");
      for (const match of prisma.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
        models.set(
          match[1],
          new Set([...match[2].matchAll(/^\s+(\w+)\s+\w/gm)].map((m) => m[1])),
        );
      }
    }
    for (const requirement of domainRequirements) {
      const result = validateDomainExpectation(requirement.expectation, {
        root,
        openapi,
        models,
        capabilities: requirementCapabilities.get(requirement.id),
        appliesTo: requirement.applies_to,
      });
      domainErrors.push(
        ...result.errors.map((error) => `${requirement.id}: ${error}`),
      );
      domainReferences.push({
        requirement: requirement.id,
        validatedPaths: result.validatedPaths,
        bindingPaths: result.bindingPaths,
      });
    }
  }
  const ownershipErrors = await validateCanonicalTestOwnership(
    files,
    root,
    testNames,
  );
  const missing = files
    .flatMap(({ data }) => collectRequirements(data))
    .filter((requirement) => !requirement.acceptance)
    .map((requirement) => requirement.id);
  const errors = [
    ...references.errors,
    ...domainErrors,
    ...ownershipErrors,
    ...(complete
      ? missing.map((id) => `${id}: missing canonical acceptance test`)
      : []),
  ];
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    files: files.length,
    validation: {
      schema: "passed" as const,
      consistency: "passed" as const,
      domainReferences,
    },
    ...references,
    missing,
    complete: missing.length === 0,
  };
}
