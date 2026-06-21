import * as ts from "typescript";

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type RouteExportKind = "function" | "const" | "destructured";

function hasExportModifier(node: ts.Node) {
  return Boolean(
    ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
}

function isConstDeclaration(statement: ts.VariableStatement) {
  return Boolean(statement.declarationList.flags & ts.NodeFlags.Const);
}

function bindingNameExportsMethod(name: ts.BindingName, method: HttpMethod) {
  return ts.isIdentifier(name) && name.text === method;
}

function objectBindingExportsMethod(
  name: ts.ObjectBindingPattern,
  method: HttpMethod,
) {
  return name.elements.some((element) => {
    if (element.propertyName && !ts.isIdentifier(element.propertyName)) {
      return false;
    }
    if (!bindingNameExportsMethod(element.name, method)) {
      return false;
    }
    return !element.propertyName || element.propertyName.text === method;
  });
}

export function getRouteExportKind(
  source: string,
  httpMethod: HttpMethod,
): RouteExportKind | null {
  const sourceFile = ts.createSourceFile(
    "route.ts",
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      if (hasExportModifier(statement) && statement.name?.text === httpMethod) {
        return "function";
      }
      continue;
    }

    if (
      !ts.isVariableStatement(statement) ||
      !hasExportModifier(statement) ||
      !isConstDeclaration(statement)
    ) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (bindingNameExportsMethod(declaration.name, httpMethod)) {
        return "const";
      }
      if (
        ts.isObjectBindingPattern(declaration.name) &&
        objectBindingExportsMethod(declaration.name, httpMethod)
      ) {
        return "destructured";
      }
    }
  }

  return null;
}

export function getExportedRouteMethods(
  source: string,
  methods: readonly HttpMethod[] = HTTP_METHODS,
) {
  return methods.filter((method) => getRouteExportKind(source, method));
}
