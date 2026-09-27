import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "svelte/compiler";
import ts from "typescript";
import { expect, it } from "vitest";
import { SHELL_THEME_CHANGE_EVENT } from "@/lib/components/shell/app-shell-actions";
import { SIDEBAR_KEYBOARD_SHORTCUT } from "@/lib/components/ui/sidebar/constants";

const owner = "src/lib/components/SearchField.svelte";
const helper = "src/lib/browser/page-search-shortcut.ts";
const shell = "src/lib/components/shell/AppShell.svelte";
const sidebar = "src/lib/components/ui/sidebar/sidebar-provider.svelte";

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
  const matcherImports: string[] = [];
  const mountCalls: string[] = [];
  const globalRegistrations: string[] = [];
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
      function inspectTemplate(value: unknown): void {
        if (Array.isArray(value)) {
          value.forEach(inspectTemplate);
          return;
        }
        if (!value || typeof value !== "object") return;
        const node = value as Record<string, unknown>;
        if (node.type === "SvelteWindow" || node.type === "SvelteDocument") {
          for (const attribute of node.attributes as Array<
            Record<string, unknown>
          >) {
            if (filename === sidebar && attribute.name === "onkeydown") {
              expect(SIDEBAR_KEYBOARD_SHORTCUT.toLowerCase()).not.toBe("k");
              globalRegistrations.push(filename);
              continue;
            }
            expect(
              [
                "onkeydown",
                "onkeyup",
                "onkeypress",
                "keydown",
                "keyup",
                "keypress",
              ],
              filename,
            ).not.toContain(attribute.name);
          }
        }
        Object.values(node).forEach(inspectTemplate);
      }
      inspectTemplate(component.fragment);
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
          const imported = (binding.propertyName ?? binding.name).text;
          if (imported === "mountPageSearchShortcut") {
            mountImports.push(filename);
            mountNames.add(binding.name.text);
          }
          if (imported === "isPageSearchShortcut")
            matcherImports.push(filename);
        }
      }
      function inspect(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
          if (
            ts.isIdentifier(node.expression) &&
            mountNames.has(node.expression.text)
          )
            mountCalls.push(filename);
          if (ts.isPropertyAccessExpression(node.expression)) {
            const receiver = node.expression.expression;
            const event = node.arguments[0];
            if (
              ts.isIdentifier(receiver) &&
              ["window", "document", "globalThis"].includes(receiver.text) &&
              node.expression.name.text === "addEventListener"
            ) {
              if (
                filename === shell &&
                event &&
                ts.isIdentifier(event) &&
                event.text === "SHELL_THEME_CHANGE_EVENT"
              ) {
                expect(["keydown", "keyup", "keypress"]).not.toContain(
                  SHELL_THEME_CHANGE_EVENT,
                );
              } else {
                expect(event && ts.isStringLiteral(event), filename).toBe(true);
              }
              if (
                event &&
                ts.isStringLiteral(event) &&
                ["keydown", "keyup", "keypress"].includes(event.text)
              )
                globalRegistrations.push(filename);
            }
          }
        }
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
    }
  }
  expect(mountImports).toEqual([owner]);
  expect(mountCalls).toEqual([owner]);
  expect(matcherImports).toEqual([]);
  expect(globalRegistrations.sort()).toEqual([helper, shell, sidebar].sort());
});
