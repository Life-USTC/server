import { readFile } from "node:fs/promises";
import { parse } from "svelte/compiler";
import ts from "typescript";
import { expect, it } from "vitest";

async function scriptAst(filename: string) {
  const source = await readFile(filename, "utf8");
  if (!filename.endsWith(".svelte"))
    return ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const component = parse(source, { filename, modern: true });
  const scripts = [component.instance, component.module].flatMap((script) => {
    if (!script) return [];
    const content = script.content as typeof script.content & {
      start: number;
      end: number;
    };
    return [source.slice(content.start, content.end)];
  });
  return ts.createSourceFile(
    filename,
    scripts.join("\n"),
    ts.ScriptTarget.Latest,
    true,
  );
}

it("ui.list-table-8", async () => {
  const routes = [
    "catalog/courses",
    "catalog/sections",
    "catalog/teachers",
    "catalog/links",
    "catalog/young-events",
    "catalog/young-events/calendar",
    "catalog/young-events/organizers",
    "news",
    "news/sources",
  ].map((route) => `src/routes/${route}/+page.server.ts`);
  const primitives = [
    "PageLayout",
    "PageHeader",
    "Panel",
    "PageSectionNav",
    "SearchField",
    "ListPagination",
  ].map((component) => `src/lib/components/${component}.svelte`);
  for (const filename of [...routes, ...primitives]) {
    const ast = await scriptAst(filename);
    const featureImports = new Set<string>();
    const featureCalls = new Set<string>();
    const isRoute = routes.includes(filename);
    for (const statement of ast.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const module = statement.moduleSpecifier.text;
      if (isRoute) {
        if (
          module.startsWith("@/features/") &&
          statement.importClause?.namedBindings &&
          ts.isNamedImports(statement.importClause.namedBindings)
        ) {
          for (const binding of statement.importClause.namedBindings.elements)
            featureImports.add(binding.name.text);
        }
        expect(module, filename).not.toMatch(
          /(?:cache|request-schemas|query-filters|db\/prisma)/,
        );
      } else {
        expect(module, filename).not.toMatch(
          /(?:features\/|\$app\/stores|\$app\/state|cache|db\/prisma)/,
        );
      }
    }
    function inspect(node: ts.Node): void {
      if (ts.isPropertyAccessExpression(node))
        expect(node.name.text, filename).not.toMatch(
          /^(?:searchParams|caches)$/,
        );
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression))
        expect(node.expression.text, filename).not.toMatch(
          /^(?:URL|URLSearchParams)$/,
        );
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        expect(node.expression.text, filename).not.toMatch(
          /^(?:fetch|cached|getCached|unstable_cache)$/,
        );
        if (featureImports.has(node.expression.text))
          featureCalls.add(node.expression.text);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(ast);
    if (isRoute) expect(featureCalls.size, filename).toBeGreaterThan(0);
  }
});
