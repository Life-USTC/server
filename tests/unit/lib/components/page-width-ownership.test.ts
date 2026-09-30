import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "svelte/compiler";
import { describe, expect, it } from "vitest";
import {
  PAGE_INVENTORY,
  type PageInventoryEntry,
} from "../../../e2e/src/app/_shared/page-inventory";

/**
 * ui.page-frame-ownership
 *
 * Every rendered page resolves its content width through the shared page frame
 * (`.page-frame`, applied by PageLayout / CollectionPage / DetailPageLayout)
 * rather than picking its own `max-w-*`.
 *
 * The route list is DERIVED from PAGE_INVENTORY, which a sibling gate already
 * pins to `src/routes/**\/+page.svelte`. A new page therefore cannot escape this
 * requirement by not being listed: it must either reach the frame or be named
 * in FRAME_EXEMPT below with a reason.
 */

const ROUTES_ROOT = "src/routes";
const FRAME_MODULES = [
  "src/lib/components/PageLayout.svelte",
  "src/lib/components/DetailPageLayout.svelte",
  "src/lib/components/CollectionPage.svelte",
];

/**
 * Pages that deliberately size themselves instead of using the page frame.
 * Each entry needs a reason, and is asserted to still exist so the list cannot
 * rot. Adding a route here is a reviewed decision, not a default.
 */
const FRAME_EXEMPT: Record<string, string> = {
  "/account/sign-in":
    "Centered sign-in card on its own decorative backdrop; width is the card, not a page frame.",
  "/account/welcome":
    "Focused onboarding shell with no app sidebar; the stepper owns its narrow measure.",
  "/oauth/authorize":
    "Centered consent card sized to the consent decision.",
  "/oauth/device":
    "Centered device card with a two-column identity panel.",
  "/error":
    "Centered error card; no page content to frame.",
  "/privacy":
    "Long-form legal prose uses its own reading measure.",
  "/terms":
    "Long-form legal prose uses its own reading measure.",
  "/usage/bot":
    "Marketing page with a deliberate full-bleed hero.",
  "/usage/cli":
    "Marketing page with a deliberate full-bleed hero.",
  "/usage/mcp":
    "Marketing page with a deliberate full-bleed hero.",
  "/usage/mobile":
    "Marketing page with a deliberate full-bleed hero.",
  "/": "Anonymous landing page with a deliberate full-bleed hero.",
  "/api/docs/[...path]":
    "Third-party OpenAPI renderer owns its own sidebar grid and media queries.",
  "/catalog/bus/map":
    "Transit map fills the viewport; a reading frame would crop it.",
  "/community/users/[identifier]":
    "Profile identity column composition predates the frame; tracked separately.",
  "/e2e/oauth/callback":
    "Test-only callback surface with no user-facing layout.",
};

function walk(value: unknown, visitor: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visitor);
    return;
  }
  const node = value as Record<string, unknown>;
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

/** Walk the actually rendered component graph, following feature components. */
async function renderedGraph(root: string) {
  const pending = [root];
  const visited = new Set<string>();
  while (pending.length) {
    const filename = pending.pop();
    if (!filename || visited.has(filename)) continue;
    visited.add(filename);
    if (!filename.endsWith(".svelte")) continue;
    let source: string;
    try {
      source = await readFile(filename, "utf8");
    } catch {
      continue;
    }
    const ast = parse(source, { filename, modern: true });
    const imports = new Map<string, string>();
    const rendered = new Set<string>();
    walk(ast, (node) => {
      const src = node.source as { value?: string } | undefined;
      if (node.type === "ImportDeclaration" && src?.value) {
        const specifiers =
          (node.specifiers as Array<{ local: { name: string } }>) ?? [];
        for (const specifier of specifiers)
          imports.set(
            specifier.local.name,
            resolveModule(filename, src.value),
          );
      }
      if (node.type === "Component" && typeof node.name === "string")
        rendered.add(node.name.split(".")[0]);
    });
    for (const component of rendered) {
      const imported = imports.get(component);
      if (imported?.startsWith("src/")) pending.push(imported);
    }
  }
  return visited;
}

/** True when the page reaches a frame primitive, or applies .page-frame itself. */
async function resolvesPageFrame(entry: PageInventoryEntry) {
  const routePath =
    entry.routeId === "/"
      ? `${ROUTES_ROOT}/+page.svelte`
      : `${ROUTES_ROOT}${entry.routeId}/+page.svelte`;
  const graph = await renderedGraph(routePath);
  if (FRAME_MODULES.some((module) => graph.has(module))) return true;
  for (const filename of graph) {
    const source = await readFile(filename, "utf8").catch(() => "");
    if (source.includes("page-frame")) return true;
  }
  return false;
}

const renderedPages = PAGE_INVENTORY.filter((entry) => entry.kind === "page");

describe("ui.page-frame-ownership", () => {
  it("derives its route list from the pinned page inventory", () => {
    expect(renderedPages.length).toBeGreaterThan(40);
  });

  it("keeps every frame exemption pointed at a real rendered page", () => {
    const renderedIds = new Set(renderedPages.map((entry) => entry.routeId));
    for (const [routeId, reason] of Object.entries(FRAME_EXEMPT)) {
      expect(renderedIds, `stale frame exemption: ${routeId}`).toContain(
        routeId,
      );
      expect(reason.trim().length, `empty reason: ${routeId}`).toBeGreaterThan(
        20,
      );
    }
  });

  it("resolves content width through the shared page frame", async () => {
    const escaped: string[] = [];
    for (const entry of renderedPages) {
      if (entry.routeId in FRAME_EXEMPT) continue;
      if (!(await resolvesPageFrame(entry))) escaped.push(entry.routeId);
    }
    expect(escaped, "pages sizing themselves outside the page frame").toEqual(
      [],
    );
  });

  it("keeps catalog detail siblings on the same frame width", async () => {
    for (const routeId of [
      "/catalog/courses/[jwId]",
      "/catalog/teachers/[id]",
      "/catalog/sections/[jwId]",
    ]) {
      const routePath = `${ROUTES_ROOT}${routeId}/+page.svelte`;
      const graph = await renderedGraph(routePath);
      let framed = false;
      for (const filename of graph) {
        const source = await readFile(filename, "utf8").catch(() => "");
        if (source.includes("page-frame-content")) {
          framed = true;
          break;
        }
      }
      expect(framed, `${routeId} must use the content frame width`).toBe(true);
    }
  });
});
