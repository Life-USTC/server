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
    : module.startsWith("#lib/")
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
    // CollectionPage owns page composition; TableFilterFields owns Field composition.
    // Follow these explicit shared compositions to verify their rendered primitives.
    if (
      !filename.endsWith(".svelte") ||
      (filename.startsWith("src/lib/") &&
        filename !== "src/lib/components/CollectionPage.svelte" &&
        filename !== "src/lib/components/TableFilterFields.svelte")
    )
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
      "src/routes/catalog/young-events/[youngId]/+page.svelte",
    ),
  ).toContain("src/lib/components/Panel.svelte");
  expect(
    await renderedPrimitives(
      "src/routes/community/users/[identifier]/+page.svelte",
    ),
  ).toContain("src/lib/components/Panel.svelte");
  for (const root of [
    "homeworks/components/HomeworkDetailDialog",
    "workspace/components/TodoDetailDialog",
  ])
    expect(
      await renderedPrimitives(`src/features/${root}.svelte`),
      root,
    ).toContain("src/lib/components/ui/dialog");
  expect(
    await renderedPrimitives(
      "src/features/publications/components/PublicationSourceDirectoryPage.svelte",
    ),
  ).toContain("src/lib/components/PageSectionNav.svelte");
  for (const root of [
    "young/components/YoungEventsPage",
    "young/components/YoungCalendarPage",
    "young/components/YoungOrganizersPage",
    "admin/components/AdminModerationPageController",
    "settings/components/SettingsPageController",
  ]) {
    const primitives = await renderedPrimitives(`src/features/${root}.svelte`);
    expect(primitives, root).not.toContain(
      "src/lib/components/PageSectionNav.svelte",
    );
    expect(primitives, root).not.toContain(
      "src/lib/components/DetailSectionNav.svelte",
    );
  }
  for (const root of [
    "catalog/components/CatalogColumnFilter",
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
    "SearchField",
    "FilterToolbar",
    "ResponsiveCollection",
    "WorkspaceCollection",
    "ResultsSummary",
    "ResultsEmpty",
    "CollectionEmpty",
    "CollectionListShell",
    "CollectionTableShell",
    "TableColumnHeader",
    "TableControlsRow",
    "MobileListCard",
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

it("ui.collection-primitive-ownership", async () => {
  for (const root of [
    "admin/components/AdminUsersTableCard",
    "admin/components/AdminModerationComments",
    "admin/components/AdminModerationDescriptions",
    "admin/components/AdminModerationHomeworks",
    "admin/components/AdminModerationSuspensions",
    "admin/components/AdminOAuthClients",
    "admin/components/AdminBusVersions",
    "catalog/components/CourseDetailSections",
    "catalog/components/TeacherDetailSections",
    "section-detail/components/SectionHomeworkListView",
  ]) {
    const graph = await renderedPrimitives(`src/features/${root}.svelte`);
    for (const name of ["ResponsiveCollection", "MobileListCard"])
      expect(graph, root).toContain(`src/lib/components/${name}.svelte`);
    if (root.startsWith("admin/"))
      for (const name of ["CollectionListShell", "CollectionTableShell"])
        expect(graph, root).toContain(`src/lib/components/${name}.svelte`);
  }
  for (const root of [
    "catalog/components/CoursesResults",
    "catalog/components/TeachersResults",
    "catalog/components/SectionsResults",
    "young/components/YoungEventsPage",
    "young/components/YoungOrganizersPage",
    "workspace/components/HomeworksCardsView",
    "workspace/components/TodosCardsView",
    "workspace/components/ExamsCardsView",
    "workspace/components/SubscriptionsCardsView",
  ])
    expect(
      await renderedPrimitives(`src/features/${root}.svelte`),
      root,
    ).toContain("src/lib/components/MobileListCard.svelte");

  // Calendar/action layouts do not swap collections. The grouped source table
  // switches rows in place so its global search and canonical group anchors
  // have a single DOM owner at every width (covered by its browser contract).
  const featureOwnedVisibility = new Set([
    "publications/components/PublicationSourceDirectoryPage.svelte",
    "young/components/YoungCalendar.svelte",
    "young/components/PersonalActivityCalendar.svelte",
    "workspace/components/CalendarTab.svelte",
    "workspace/components/CalendarTabToolbar.svelte",
    "workspace/components/TodosTabToolbar.svelte",
    "workspace/components/HomeworksTabToolbar.svelte",
    "section-detail/components/SectionDetailHeader.svelte",
    "section-detail/components/SectionDetailMainContent.svelte",
  ]);
  for (const relative of await readdir("src/features", { recursive: true })) {
    if (!relative.endsWith(".svelte") || featureOwnedVisibility.has(relative))
      continue;
    const filename = `src/features/${relative}`;
    const ast = parse(await readFile(filename, "utf8"), {
      filename,
      modern: true,
    });
    walk(ast, (node) => {
      if (node.type !== "Attribute" || node.name !== "class") return;
      walk(node.value, (part) => {
        const value =
          part.type === "Text"
            ? part.data
            : part.type === "Literal"
              ? part.value
              : undefined;
        if (typeof value === "string")
          expect(value, filename).not.toMatch(
            /\b(?:md|xl):hidden\b|\bhidden\b.*\b(?:md|xl):(?:block|flex|grid)\b/,
          );
      });
    });
  }
});
