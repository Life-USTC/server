import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import ts from "typescript";

export type DomainExpectationContext = {
  root: string;
  openapi?: Record<string, unknown>;
  models?: ReadonlyMap<string, ReadonlySet<string>>;
  capabilities?: Record<string, unknown>;
  appliesTo?: readonly string[];
};

const kinds = new Set([
  "reminder_window",
  "transaction_effects",
  "unchanged_write",
  "delete_replay",
  "public_projection",
  "ordered_page",
  "private_setting_authority",
  "localized_regions",
  "membership_kind_transition",
]);
export function isDomainExpectationKind(kind: unknown): boolean {
  return typeof kind === "string" && kinds.has(kind);
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const pointer = (value: string) =>
  value.replaceAll("~", "~0").replaceAll("/", "~1");

/** Validate domain references without treating resolved behavior as execution evidence. */
export function validateDomainExpectation(
  expectation: Record<string, unknown>,
  context: DomainExpectationContext,
): { errors: string[]; validatedPaths: string[]; bindingPaths: string[] } {
  const errors: string[] = [];
  const validatedPaths: string[] = [];
  const bindingPaths: string[] = [];
  if (!isDomainExpectationKind(expectation.kind))
    return { errors, validatedPaths, bindingPaths };
  function source(value: unknown, path: string) {
    if (
      !object(value) ||
      typeof value.module !== "string" ||
      typeof value.export !== "string"
    ) {
      errors.push(`${path}: expected a source module/export reference`);
      return;
    }
    try {
      const root = realpathSync(context.root);
      const file = realpathSync(resolve(root, value.module));
      const rel = relative(root, file);
      if (
        isAbsolute(rel) ||
        rel === ".." ||
        rel.startsWith("../") ||
        !rel.startsWith("src/")
      )
        throw new Error("source reference escapes repository source");
      const ast = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const names = new Set<string>();
      for (const statement of ast.statements) {
        if (
          !ts.canHaveModifiers(statement) ||
          !ts
            .getModifiers(statement)
            ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        )
          continue;
        if (ts.isFunctionDeclaration(statement) && statement.name)
          names.add(statement.name.text);
        if (ts.isVariableStatement(statement))
          for (const declaration of statement.declarationList.declarations)
            if (ts.isIdentifier(declaration.name))
              names.add(declaration.name.text);
      }
      if (!names.has(value.export))
        throw new Error(`missing exported operation ${value.export}`);
      bindingPaths.push(`${path}/module`, `${path}/export`);
    } catch (error) {
      errors.push(`${path}: ${String(error)}`);
    }
  }
  if (
    expectation.kind !== "private_setting_authority" &&
    expectation.kind !== "localized_regions"
  )
    source(expectation.operation, "/operation");
  if (expectation.kind === "private_setting_authority") {
    if (!context.capabilities || !context.appliesTo?.length)
      errors.push("private_setting_authority requires capability bindings");
    if (object(expectation.operations))
      for (const [surface, name] of Object.entries(expectation.operations)) {
        const operations = new Set<string>();
        for (const id of context.appliesTo ?? []) {
          const capability = context.capabilities?.[id];
          const binding = object(capability) ? capability[surface] : undefined;
          if (!object(binding)) continue;
          const rows =
            surface === "rest"
              ? binding.routes
              : surface === "mcp"
                ? binding.tools
                : [
                    ...(Array.isArray(binding.queries) ? binding.queries : []),
                    ...(Array.isArray(binding.mutations)
                      ? binding.mutations
                      : []),
                  ];
          if (!Array.isArray(rows)) continue;
          for (const row of rows)
            if (object(row))
              operations.add(
                surface === "rest"
                  ? `${row.method ?? "GET"} ${row.path}`
                  : String(row.name),
              );
        }
        if (typeof name !== "string" || !operations.has(name))
          errors.push(
            `operations/${surface}: operation is not bound to an applicable capability`,
          );
        else bindingPaths.push(`/operations/${surface}`);
      }
  }
  if (expectation.kind === "localized_regions") {
    try {
      const root = realpathSync(context.root);
      const page = realpathSync(
        resolve(root, `src/routes${expectation.route}/+page.svelte`),
      );
      if (!page.startsWith(`${root}/src/routes/`))
        throw new Error("route escapes source root");
      bindingPaths.push("/route");
    } catch {
      errors.push("route: missing page component");
    }
  }
  if (
    expectation.kind === "membership_kind_transition" &&
    Array.isArray(expectation.additional_operations)
  )
    expectation.additional_operations.forEach((operation, index) => {
      source(operation, `/additional_operations/${index}`);
    });
  if (expectation.kind === "transaction_effects") {
    for (const phase of ["before_commit", "after_completion"]) {
      const effects = expectation[phase];
      if (!Array.isArray(effects)) continue;
      const seen = new Set<string>();
      effects.forEach((effect, i) => {
        if (!object(effect)) return;
        source(effect.operation, `/${phase}/${i}/operation`);
        const id = JSON.stringify(effect.operation);
        if (seen.has(id)) errors.push(`${phase}: duplicate effect operation`);
        seen.add(id);
      });
    }
  }
  function dereference(value: unknown): Record<string, unknown> | undefined {
    const visited = new Set<string>();
    while (object(value) && typeof value.$ref === "string") {
      const ref = value.$ref;
      if (!ref.startsWith("#/") || visited.has(ref)) return;
      visited.add(ref);
      value = context.openapi;
      for (const part of ref.slice(2).split("/")) {
        if (!object(value)) return;
        value = value[part.replaceAll("~1", "/").replaceAll("~0", "~")];
      }
    }
    return object(value) ? value : undefined;
  }
  function property(schema: Record<string, unknown> | undefined, key: string) {
    if (!schema) return;
    if (key === "items") return dereference(schema.items);
    const props = schema.properties;
    return object(props) ? dereference(props[key]) : undefined;
  }
  if (expectation.kind === "public_projection") {
    if (!context.openapi)
      errors.push("public_projection requires the generated OpenAPI document");
    const response = expectation.response;
    if (
      object(response) &&
      typeof response.schema === "string" &&
      typeof response.path === "string"
    ) {
      let schema = dereference({
        $ref: `#/components/schemas/${response.schema}`,
      });
      for (const key of response.path.split("/").filter(Boolean))
        schema = property(schema, key);
      if (!schema || !object(schema.properties))
        errors.push("response: unresolved object projection");
      else {
        bindingPaths.push("/response/schema", "/response/path");
        if (Array.isArray(expectation.fields))
          for (const [i, field] of expectation.fields.entries()) {
            if (typeof field !== "string" || !property(schema, field))
              errors.push(`fields: unknown projected field ${String(field)}`);
            else validatedPaths.push(`/fields/${i}`);
          }
        if (object(expectation.preserves))
          for (const path of Object.keys(expectation.preserves)) {
            let target: Record<string, unknown> | undefined = schema;
            for (const key of path.split("/")) target = property(target, key);
            if (!target)
              errors.push(`preserves: unknown projected value path ${path}`);
            else validatedPaths.push(`/preserves/${pointer(path)}`);
          }
      }
    }
  }
  if (expectation.kind === "ordered_page") {
    if (!context.models)
      errors.push("ordered_page requires the Prisma model field catalog");
    const fields = context.models?.get(String(expectation.model));
    if (!fields) errors.push(`unknown model ${String(expectation.model)}`);
    else {
      bindingPaths.push("/model");
      if (Array.isArray(expectation.order))
        expectation.order.forEach((item, i) => {
          if (!object(item) || !fields.has(String(item.field)))
            errors.push(
              `order: unknown model field ${object(item) ? String(item.field) : i}`,
            );
          else validatedPaths.push(`/order/${i}/field`);
        });
    }
  }
  return {
    errors,
    validatedPaths,
    bindingPaths: errors.length ? [] : bindingPaths,
  };
}
