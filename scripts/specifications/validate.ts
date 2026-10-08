import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnySchema, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import {
  isDomainExpectationKind,
  validateDomainExpectation,
} from "./domain-semantics";
import {
  type Requirement,
  readSpecifications,
  type SpecificationFile,
} from "./repository";
import { repositoryRoot } from "./yaml";

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

export async function validateSpecificationReferences(
  files: SpecificationFile[],
): Promise<{
  errors: string[];
  requirements: number;
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
  let requirements = 0;
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
  return { errors, requirements };
}

export async function checkSpecifications(root = repositoryRoot) {
  const [files, validators] = await Promise.all([
    readSpecifications(root),
    loadSpecificationValidators(root),
  ]);
  if (!files.length) throw new Error("No YAML specifications found");
  const shapeErrors = validateSpecificationShapes(files, validators);
  if (shapeErrors.length) throw new Error(shapeErrors.join("\n"));
  const references = await validateSpecificationReferences(files);
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
    }
  }
  const errors = [...references.errors, ...domainErrors];
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    files: files.length,
    ...references,
  };
}
