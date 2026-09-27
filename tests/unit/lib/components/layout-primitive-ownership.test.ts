import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "svelte/compiler";
import { expect, it } from "vitest";

type Node = {
  type?: string;
  name?: string;
  source?: { value?: string };
  specifiers?: Array<{ type: string; local: { name: string } }>;
  [key: string]: unknown;
};
function walk(value: unknown, visitor: (node: Node) => void): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visitor);
    return;
  }
  const node = value as Node;
  if (node.type) visitor(node);
  for (const child of Object.values(node)) walk(child, visitor);
}
function resolveModule(filename: string, module: string) {
  const resolved = module.startsWith("@/")
    ? `src/${module.slice(2)}`
    : module.startsWith("$lib/")
      ? `src/lib/${module.slice(5)}`
      : module.startsWith(".")
        ? path.posix.join(path.posix.dirname(filename), module)
        : module;
  return resolved.replace(/\/index\.js$/, "");
}
async function renderedPrimitives(root: string) {
  const pending = [root];
  const visited = new Set<string>();
  while (pending.length) {
    const filename = pending.pop();
    if (!filename || visited.has(filename)) continue;
    visited.add(filename);
    // Shared components are leaves: a feature must actually render the imported
    // primitive, not merely import another component that happens to import it.
    if (!filename.endsWith(".svelte") || filename.startsWith("src/lib/"))
      continue;
    const ast = parse(await readFile(filename, "utf8"), {
      filename,
      modern: true,
    });
    const imports = new Map<string, string>();
    const rendered = new Set<string>();
    walk(ast, (node) => {
      if (node.type === "ImportDeclaration" && node.source?.value) {
        for (const specifier of node.specifiers ?? [])
          imports.set(
            specifier.local.name,
            resolveModule(filename, node.source.value),
          );
      }
      if (node.type === "Component" && node.name)
        rendered.add(node.name.split(".")[0]);
    });
    for (const component of rendered) {
      const imported = imports.get(component);
      if (imported?.startsWith("src/")) pending.push(imported);
    }
  }
  return visited;
}

it("ui.layout-principles-4", async () => {
  const commonPages = [
    "catalog/courses",
    "catalog/teachers",
    "catalog/sections",
    "catalog/links",
    "catalog/young-events",
    "catalog/young-events/calendar",
    "catalog/young-events/[youngId]",
    "catalog/young-events/organizers",
    "catalog/young-events/organizers/[organizerId]",
    "news",
    "news/[id]",
    "news/sources",
    "search",
    "workspace/[tab]",
    "workspace/uploads",
    "workspace/subscriptions/activities",
    "admin/users",
    "admin/moderation",
    "admin/oauth",
    "admin/bus",
  ];
  const panelPages = [
    "catalog/courses",
    "catalog/teachers",
    "catalog/sections",
    "catalog/young-events",
    "catalog/young-events/calendar",
    "catalog/young-events/[youngId]",
    "catalog/young-events/organizers",
    "catalog/young-events/organizers/[organizerId]",
    "news",
    "news/[id]",
    "news/sources",
    "workspace/uploads",
    "workspace/subscriptions/activities",
  ];
  for (const route of commonPages) {
    const graph = await renderedPrimitives(`src/routes/${route}/+page.svelte`);
    for (const name of ["PageLayout", "PageHeader"])
      expect(graph, route).toContain(`src/lib/components/${name}.svelte`);
    if (panelPages.includes(route))
      expect(graph, route).toContain("src/lib/components/Panel.svelte");
  }
  for (const route of [
    "catalog/courses/[jwId]",
    "catalog/courses/[jwId]/[section]",
    "catalog/teachers/[id]",
    "catalog/teachers/[id]/[section]",
  ]) {
    const graph = await renderedPrimitives(`src/routes/${route}/+page.svelte`);
    for (const name of ["DetailPageLayout", "PageHeader"])
      expect(graph, route).toContain(`src/lib/components/${name}.svelte`);
  }
  // Section detail owns its stream lifecycle and profile owns its identity
  // composition; each reuses the primitives appropriate to those structures.
  for (const route of [
    "catalog/sections/[jwId]",
    "catalog/sections/[jwId]/[section]",
  ])
    expect(
      await renderedPrimitives(`src/routes/${route}/+page.svelte`),
      route,
    ).toContain("src/lib/components/PageHeader.svelte");
  expect(
    await renderedPrimitives(
      "src/routes/community/users/[identifier]/+page.svelte",
    ),
  ).toContain("src/lib/components/ui/card");
  for (const root of [
    "homeworks/components/HomeworkDetailDialog",
    "workspace/components/TodoDetailDialog",
  ])
    expect(
      await renderedPrimitives(`src/features/${root}.svelte`),
      root,
    ).toContain("src/lib/components/ui/dialog");
  for (const root of [
    "young/components/YoungBrowseNav",
    "admin/components/AdminModerationPageController",
    "publications/components/PublicationSourceDirectoryPage",
  ])
    expect(
      await renderedPrimitives(`src/features/${root}.svelte`),
      root,
    ).toContain("src/lib/components/PageSectionNav.svelte");
  expect(
    await renderedPrimitives(
      "src/features/settings/components/SettingsPageController.svelte",
    ),
  ).toContain("src/lib/components/DetailSectionNav.svelte");
  for (const root of [
    "catalog/components/CoursesFilters",
    "catalog/components/TeachersFilters",
    "catalog/components/SectionsFilters",
    "young/components/YoungEventFilters",
    "workspace/components/TodoFormFields",
    "workspace/components/HomeworkCreateFormFields",
    "profile/components/ProfileIdentityFields",
  ])
    expect(
      await renderedPrimitives(`src/features/${root}.svelte`),
      root,
    ).toContain("src/lib/components/ui/field");
});

it("ui.feature-interaction-ownership", async () => {
  const primitives = [
    "PageLayout",
    "PageHeader",
    "DetailPageLayout",
    "Panel",
    "PageSectionNav",
    "DetailSectionNav",
    "SearchField",
    "FilterToolbar",
    "ResponsiveCollection",
    "ResultsSummary",
    "ResultsEmpty",
    "ListPagination",
  ].map((name) => `src/lib/components/${name}.svelte`);
  for (const name of await readdir("src/lib/components/ui/field"))
    if (name.endsWith(".svelte"))
      primitives.push(`src/lib/components/ui/field/${name}`);
  for (const filename of primitives) {
    const ast = parse(await readFile(filename, "utf8"), {
      filename,
      modern: true,
    });
    walk(ast, (node) => {
      if (node.type === "ImportDeclaration" && node.source?.value)
        expect(
          resolveModule(filename, node.source.value),
          filename,
        ).not.toMatch(
          /(?:src\/features\/|\$app\/(?:stores|state)|\/server\/|\/db\/)/,
        );
      if (node.type === "CallExpression") {
        const callee = node.callee as Node | undefined;
        const property = callee?.property as Node | undefined;
        expect(callee?.name ?? property?.name, filename).not.toBe("fetch");
      }
      const literal =
        node.type === "Literal"
          ? node.value
          : node.type === "Text"
            ? node.data
            : undefined;
      if (typeof literal === "string")
        expect(literal, filename).not.toMatch(
          /^\/(?:api|catalog|workspace|account|admin|news)(?:\/|\?|$)/,
        );
    });
  }
});
