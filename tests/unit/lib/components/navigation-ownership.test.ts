import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "svelte/compiler";
import { expect, it } from "vitest";

type SyntaxNode = {
  type?: string;
  name?: string;
  source?: { value?: string };
  specifiers?: Array<{ type: string; local: { name: string } }>;
  [key: string]: unknown;
};
function walk(value: unknown, visitor: (node: SyntaxNode) => void): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visitor);
    return;
  }
  const node = value as SyntaxNode;
  if (node.type) visitor(node);
  for (const child of Object.values(node)) walk(child, visitor);
}

async function renderedComponents(root: string) {
  const pending = [root];
  const visited = new Set<string>();
  while (pending.length) {
    const filename = pending.pop()!;
    if (visited.has(filename)) continue;
    visited.add(filename);
    if (!filename.startsWith("src/features/")) continue;
    const ast = parse(await readFile(filename, "utf8"), {
      filename,
      modern: true,
    });
    const imports = new Map<string, string>();
    const rendered = new Set<string>();
    walk(ast, (node) => {
      if (
        node.type === "ImportDeclaration" &&
        node.source?.value?.endsWith(".svelte")
      ) {
        for (const specifier of node.specifiers ?? []) {
          if (specifier.type === "ImportDefaultSpecifier")
            imports.set(specifier.local.name, node.source.value);
        }
      }
      if (node.type === "Component" && node.name) rendered.add(node.name);
    });
    for (const name of rendered) {
      const module = imports.get(name);
      if (!module) continue;
      if (module.startsWith("."))
        pending.push(path.posix.join(path.posix.dirname(filename), module));
      else if (module.startsWith("@/")) pending.push(`src/${module.slice(2)}`);
      else if (module.startsWith("$lib/"))
        pending.push(`src/lib/${module.slice(5)}`);
    }
  }
  return visited;
}

it("ui.list-table-9", async () => {
  const sidebarRouteOwners = [
    "src/features/young/components/YoungEventsPage.svelte",
    "src/features/young/components/YoungEventDetailPage.svelte",
    "src/features/young/components/YoungCalendarPage.svelte",
    "src/features/young/components/YoungOrganizersPage.svelte",
    "src/features/young/components/YoungOrganizerDetailPage.svelte",
    "src/features/young/components/YoungActivityRemindersPage.svelte",
    "src/features/admin/components/AdminModerationPageController.svelte",
    "src/features/settings/components/SettingsPageController.svelte",
  ];
  for (const root of sidebarRouteOwners) {
    const components = await renderedComponents(root);
    expect(components, root).not.toContain(
      "src/lib/components/PageSectionNav.svelte",
    );
    expect(components, root).not.toContain(
      "src/lib/components/DetailSectionNav.svelte",
    );
  }
  const sources = await renderedComponents(
    "src/features/publications/components/PublicationSourceDirectoryPage.svelte",
  );
  expect(sources).toContain("src/lib/components/PageSectionNav.svelte");
  expect(sources).not.toContain("src/lib/components/DetailSectionNav.svelte");
});
