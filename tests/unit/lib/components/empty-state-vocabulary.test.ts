import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_VARIANTS } from "@/lib/components/empty-variants";

/**
 * ui.empty-state-vocabulary
 *
 * "Nothing here" is a cross-page statement: a student meets it on the catalog,
 * in the workspace, inside dialogs and on admin tables, and it should be the
 * same object every time. `CollectionEmpty` + `empty-variants.ts` already
 * declare that object as a closed set of named variants, each of which fixes
 * the empty state's padding, alignment, minimum height and borders.
 *
 * A page that passes its own box utilities instead of naming a variant adds a
 * shape to that set without renaming it, and no spec-versus-page requirement
 * can see it: every such page is individually "correct". This guard compares
 * page against page by comparing each call site against the variant system.
 *
 * Everything the rule needs is DERIVED:
 *  - the variant names come from `empty-variants.ts`;
 *  - the system's files are discovered by following what `CollectionEmpty`
 *    actually renders, down to the `Empty.Root` primitive resolved through the
 *    `ui/empty` barrel;
 *  - the guarded utility groups are read out of those files' own class
 *    declarations, so the rule tracks the system instead of restating it;
 *  - the call sites come from walking `src/features` and `src/routes`, so a new
 *    page is covered the moment it is added.
 *
 * It is value-aware in the same way `responsive-base-neutralizer.test.ts` is.
 * A call site is only flagged for a group the system itself declares, matched
 * on the exact group, so `justify-self-stretch` (a different property from the
 * primitive's `justify-center`) is not a finding, and a bare `<Empty.Root>` —
 * which renders the shared defaults unchanged — is not a finding either.
 */

const COMPOSER = "src/lib/components/CollectionEmpty.svelte";
const SCAN_ROOTS = ["src/features", "src/routes"];

/** Variant names are props, not classes; keep them out of the derived groups. */
const VARIANT_NAMES: ReadonlySet<string> = new Set(EMPTY_VARIANTS);

const BREAKPOINTS = ["sm", "md", "lg", "xl", "2xl"] as const;

/**
 * Empty states that still carry their own box utilities. Each entry pins the
 * exact class literal in the source, and the pin is re-read on every run: edit
 * one of these empty states and the gate fires until it either names a variant
 * or the pin is consciously updated. Entries may be removed, never added — a
 * new one is a failure, not a line of configuration.
 */
const UNCONVERGED: readonly { file: string; tag: string; class: string }[] = [
  {
    file: "src/features/admin/components/AdminBusVersionsTable.svelte",
    tag: "CollectionEmpty",
    class: "rounded-none",
  },
  {
    file: "src/features/api-docs/components/ApiDocsPage.svelte",
    tag: "Empty.Root",
    class: "border border-border border-solid bg-card",
  },
  {
    file: "src/features/bus/components/BusMapContent.svelte",
    tag: "Empty.Root",
    class: "py-16",
  },
  {
    file: "src/features/search/components/GlobalSearchResults.svelte",
    tag: "Empty.Root",
    class: "py-8",
  },
  {
    file: "src/features/subscriptions/components/BulkImportConfirmDialog.svelte",
    tag: "Empty.Root",
    class: "min-h-20 p-4",
  },
  {
    file: "src/features/welcome/components/WelcomeSubscriptionsStep.svelte",
    tag: "Empty.Root",
    class: "min-h-20 p-4",
  },
  {
    file: "src/features/workspace/components/BusTabCompactSummary.svelte",
    tag: "Empty.Root",
    class: "p-0",
  },
  {
    file: "src/features/workspace/components/CalendarTab.svelte",
    tag: "Empty.Root",
    class: "items-start text-left",
  },
  {
    file: "src/features/workspace/components/SubscriptionsQuickAddDialog.svelte",
    tag: "Empty.Root",
    class: "min-h-32 p-4",
  },
  {
    file: "src/features/workspace/components/WorkspaceNoSubscriptionsState.svelte",
    tag: "Empty.Root",
    class: "items-start text-left",
  },
  {
    file: "src/features/workspace/components/WorkspaceTaskEmptyState.svelte",
    tag: "CollectionEmpty",
    class: "min-h-24 py-8",
  },
];

const ELEMENT =
  /<([A-Z][\w.]*)((?:[^<>'"]|'[^']*'|"[^"]*"|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*?)\/?>/g;
const CLASS_LITERAL = /(?<![\w-])class="([^"]*)"/;
const CLASS_EXPRESSION = /(?<![\w-])class=(\{(?:[^{}]|\{[^{}]*\})*\})/;
const CN_CALL = /\bcn\(((?:[^()]|\([^()]*\))*)\)/g;
const STRING_LITERAL = /"([^"]*)"|'([^']*)'/g;

function everyMatch(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, "g");
}

/** Every class literal in a source file, however it is spelled. */
function classLiterals(source: string): string[] {
  const found: string[] = [];
  for (const [, quoted] of source.matchAll(everyMatch(CLASS_LITERAL)))
    found.push(quoted);
  for (const [, braced] of source.matchAll(everyMatch(CLASS_EXPRESSION)))
    found.push(...stringLiterals(braced));
  for (const [, call] of source.matchAll(CN_CALL))
    found.push(...stringLiterals(call));
  return found;
}

function stringLiterals(expression: string): string[] {
  const found: string[] = [];
  for (const match of expression.matchAll(STRING_LITERAL)) {
    const value = match[1] ?? match[2];
    if (value) found.push(value);
  }
  return found;
}

/**
 * The group a utility belongs to: the token without its final dash segment,
 * so `min-h-20` is `min-h` and `justify-self-stretch` is `justify-self` rather
 * than the `justify` the primitive declares.
 */
function groupOf(token: string): { breakpoint?: string; group: string } {
  const breakpoint = BREAKPOINTS.find((candidate) =>
    token.startsWith(`${candidate}:`),
  );
  const bare = breakpoint ? token.slice(breakpoint.length + 1) : token;
  if (bare.includes(":")) return { breakpoint, group: "" }; // other variants
  const cut = bare.lastIndexOf("-");
  return { breakpoint, group: cut > 0 ? bare.slice(0, cut) : bare };
}

function tokensOf(literal: string): string[] {
  return literal.split(/\s+/).filter(Boolean);
}

function resolveModule(filename: string, module: string) {
  const resolved = module.startsWith("@/")
    ? `src/${module.slice(2)}`
    : module.startsWith("#lib/")
      ? `src/lib/${module.slice(5)}`
      : module.startsWith(".")
        ? path.posix.join(path.posix.dirname(filename), module)
        : module;
  return resolved.replace(/\.js$/, "").replace(/\/index$/, "/index.ts");
}

type Imports = Map<string, string>;

/** Local component name -> resolved module path, for one Svelte file. */
function importsOf(filename: string, source: string): Imports {
  const imports: Imports = new Map();
  for (const [, clause, module] of source.matchAll(
    /import\s+([^;]*?)\s+from\s+["']([^"']+)["']/g,
  )) {
    const target = resolveModule(filename, module);
    const namespace = /^\*\s+as\s+([\w$]+)$/.exec(clause.trim());
    if (namespace) {
      imports.set(namespace[1], target);
      continue;
    }
    const direct = /^([\w$]+)$/.exec(clause.trim());
    if (direct) imports.set(direct[1], target);
  }
  return imports;
}

/**
 * The files that make up the empty-state system: the composer, whatever lib
 * components it renders, and the `Empty.Root` primitive behind them.
 */
async function discoverSystem() {
  const files = new Set<string>();
  const pending = [COMPOSER];
  let primitive: string | undefined;
  while (pending.length) {
    const filename = pending.pop();
    if (!filename || files.has(filename)) continue;
    files.add(filename);
    const source = await readFile(filename, "utf8");
    const imports = importsOf(filename, source);
    for (const [, tag] of source.matchAll(ELEMENT)) {
      const target = imports.get(tag.split(".")[0]);
      if (!target) continue;
      if (target.endsWith(".svelte")) pending.push(target);
      else if (target.endsWith("/ui/empty/index.ts")) {
        const barrel = await readFile(target, "utf8");
        const root = /import\s+Root\s+from\s+["']([^"']+)["']/.exec(barrel);
        if (root) primitive = resolveModule(target, root[1]);
      }
    }
  }
  return { files: [...files], primitive };
}

async function svelteFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.posix.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await svelteFiles(full)));
    else if (entry.name.endsWith(".svelte")) files.push(full);
  }
  return files;
}

type Declaration = { group: string; token: string };
type CallSite = {
  file: string;
  line: number;
  tag: string;
  class: string;
  declarations: Declaration[];
};

const system = await discoverSystem();

/** Guarded groups, read out of the system's own class declarations. */
const owned = new Map<string, Set<string>>();
for (const filename of [...system.files, system.primitive]) {
  if (!filename) continue;
  const source = await readFile(filename, "utf8");
  for (const literal of classLiterals(source)) {
    if (VARIANT_NAMES.has(literal)) continue;
    for (const token of tokensOf(literal)) {
      const { group } = groupOf(token);
      if (!group) continue;
      const values = owned.get(group) ?? new Set<string>();
      values.add(token);
      owned.set(group, values);
    }
  }
}

/** Every empty-state root rendered by a page, with what it declares itself. */
async function emptyStateCallSites(): Promise<CallSite[]> {
  const systemModules = new Set(system.files);
  const sites: CallSite[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of await svelteFiles(root)) {
      const source = await readFile(file, "utf8");
      const imports = importsOf(file, source);
      for (const match of source.matchAll(ELEMENT)) {
        const tag = match[1];
        const target = imports.get(tag.split(".")[0]);
        if (!target) continue;
        const isEmptyRoot =
          target.endsWith("/ui/empty/index.ts") && tag.endsWith(".Root");
        if (!isEmptyRoot && !systemModules.has(target)) continue;
        const attributes = match[2];
        const literal = CLASS_LITERAL.exec(attributes)?.[1];
        const expression = CLASS_EXPRESSION.exec(attributes)?.[1];
        const declared = literal
          ? [literal]
          : expression
            ? stringLiterals(expression)
            : [];
        const declarations: Declaration[] = [];
        for (const value of declared)
          for (const token of tokensOf(value)) {
            const { breakpoint, group } = groupOf(token);
            if (!group || !owned.has(group)) continue;
            declarations.push({
              group: breakpoint ? `${breakpoint}:${group}` : group,
              token,
            });
          }
        sites.push({
          file,
          line: source.slice(0, match.index).split("\n").length,
          tag,
          class: declared.join(" "),
          declarations,
        });
      }
    }
  }
  return sites;
}

const callSites = await emptyStateCallSites();

describe("ui.empty-state-vocabulary", () => {
  it("derives the variant system from the shared composer", () => {
    // A rename or a moved file must break discovery loudly rather than quietly
    // emptying the rule.
    expect(system.files).toContain(COMPOSER);
    expect(
      system.files.length,
      "composer plus the wrappers it renders",
    ).toBeGreaterThan(3);
    expect(system.primitive).toBe("src/lib/components/ui/empty/empty.svelte");
    expect(EMPTY_VARIANTS.length).toBeGreaterThan(4);
    expect(
      owned.size,
      "utility groups read from the system's own declarations",
    ).toBeGreaterThan(8);
  });

  it("finds the pages that render an empty state", () => {
    expect(
      callSites.length,
      "empty-state roots in features and routes",
    ).toBeGreaterThan(25);
  });

  it("keeps every unconverged pin matching its source", () => {
    const stale: string[] = [];
    for (const entry of UNCONVERGED) {
      const matching = callSites.filter(
        (site) =>
          site.file === entry.file &&
          site.tag === entry.tag &&
          site.class === entry.class,
      );
      if (matching.length !== 1)
        stale.push(
          `${entry.file} no longer renders exactly one <${entry.tag}> with ` +
            `class "${entry.class}" (found ${matching.length}). Converge it ` +
            `onto a CollectionEmpty variant and delete this pin, or update ` +
            `the pin deliberately.`,
        );
    }
    expect(stale, "unconverged pins must track the source").toEqual([]);
  });

  it("leaves the empty state's box to the variant, not the page", () => {
    const pinned = new Set(
      UNCONVERGED.map((entry) => `${entry.file}:${entry.tag}:${entry.class}`),
    );
    const variants = EMPTY_VARIANTS.join(", ");
    const offenders: string[] = [];
    for (const site of callSites) {
      if (!site.declarations.length) continue;
      if (pinned.has(`${site.file}:${site.tag}:${site.class}`)) continue;
      const tokens = site.declarations.map(({ token }) => `\`${token}\``);
      const overridden = [
        ...new Set(site.declarations.map(({ group }) => group)),
      ].map((group) => {
        const declared = [...(owned.get(group.split(":").pop() ?? "") ?? [])]
          .sort()
          .join(", ");
        return `\`${group}\` (${declared})`;
      });
      offenders.push(
        `${site.file}:${site.line} <${site.tag}> declares ` +
          `${tokens.join(", ")}, overriding the shared empty-state system's ` +
          `own ${overridden.join(" and ")}, so this page's "nothing here" is ` +
          `a shape none of CollectionEmpty's variants names. Render ` +
          `<CollectionEmpty variant="…"> with no class of its own instead; ` +
          `the variants are ${variants}.`,
      );
    }
    expect(offenders, "pages sizing their own empty state").toEqual([]);
  });
});
