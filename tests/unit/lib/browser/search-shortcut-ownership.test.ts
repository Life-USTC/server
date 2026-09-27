import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "svelte/compiler";
import ts from "typescript";
import { expect, it } from "vitest";
import {
  isGlobalSearchShortcut,
  isPageSearchShortcut,
} from "@/lib/browser/page-search-shortcut";

async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.posix.join(directory, entry.name);
      if (entry.isDirectory())
        return filename === "src/generated" ? [] : sources(filename);
      return /\.(ts|svelte)$/.test(filename) ? [filename] : [];
    }),
  );
  return nested.flat();
}

it("ui.list-table-2", async () => {
  const mountImports: string[] = [];
  const mountCalls: string[] = [];
  for (const filename of await sources("src")) {
    const source = await readFile(filename, "utf8");
    let scripts = [source];
    if (filename.endsWith(".svelte")) {
      const component = parse(source, { modern: true, filename });
      scripts = [component.instance, component.module].flatMap((script) => {
        if (!script) return [];
        const content = script.content as typeof script.content & {
          start: number;
          end: number;
        };
        return [source.slice(content.start, content.end)];
      });
    }
    for (const script of scripts) {
      const ast = ts.createSourceFile(
        filename,
        script,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const mountNames = new Set<string>();
      for (const statement of ast.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier)
        )
          continue;
        if (
          !statement.moduleSpecifier.text.endsWith(
            "/browser/page-search-shortcut",
          )
        )
          continue;
        const bindings = statement.importClause?.namedBindings;
        expect(bindings && ts.isNamedImports(bindings), filename).toBe(true);
        if (!bindings || !ts.isNamedImports(bindings)) continue;
        for (const binding of bindings.elements) {
          if (
            (binding.propertyName ?? binding.name).text ===
            "mountPageSearchShortcut"
          ) {
            mountImports.push(filename);
            mountNames.add(binding.name.text);
          }
        }
      }
      function inspect(node: ts.Node): void {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          mountNames.has(node.expression.text)
        )
          mountCalls.push(filename);
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
    }
  }
  const owner = "src/lib/components/SearchField.svelte";
  expect(mountImports).toEqual([owner]);
  expect(mountCalls).toEqual([owner]);
  for (const platform of ["ctrlKey", "metaKey"]) {
    for (const shiftKey of [false, true]) {
      const event = {
        key: "K",
        ctrlKey: false,
        metaKey: false,
        [platform]: true,
        shiftKey,
      } as unknown as KeyboardEvent;
      expect(isPageSearchShortcut(event)).toBe(shiftKey);
      expect(isGlobalSearchShortcut(event)).toBe(!shiftKey);
    }
  }
});
