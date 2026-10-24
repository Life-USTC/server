import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { componentTags } from "./svelte-component-tags";

/**
 * ui.table-column-alignment
 *
 * A table column declares its alignment twice, in two different vocabularies:
 * the header says `class="text-right"`, and the body says the same thing by
 * passing `numeric` to `CatalogTableLink`, which expands to `text-right`
 * inside that component. Nothing ties the two declarations together, so adding
 * one and forgetting the other misaligns the column — and no spec-versus-page
 * requirement can see it, because each side is individually well-formed.
 *
 * The browser gates (`ui.catalog-table-column-alignment` and
 * `remaining-table-alignment`) measure computed geometry, which this guard
 * cannot, but they can only measure the routes they visit and the columns the
 * fixtures fill. A new table, a new column on an uncovered route, or a column
 * whose fixture leaves it empty is ungated. This guard is the source-level
 * complement: it enumerates every table by walking `src/features` and
 * `src/routes`, so a table is covered the moment it is written.
 *
 * Everything the rule needs is DERIVED:
 *  - the table element roles come from the `ui/table` barrel's own exports, so
 *    `Table.Head` and `TableHead` resolve to the same primitive;
 *  - the default alignment comes from `table-head.svelte`'s own class, not from
 *    an assumption about `<th>`;
 *  - the prop-driven vocabulary is discovered by reading every component's
 *    class expressions for a prop that switches an alignment on, which is how
 *    `CatalogTableLink`'s `numeric` is found without naming it;
 *  - the tables come from walking the feature and route trees, and a table whose
 *    body rows live in an extracted row component are followed through the
 *    import.
 *
 * Matching is POSITIONAL: column N of the header row is compared against
 * column N of each body row. That is only sound when the two sequences cannot
 * diverge, so the guard proves it per row rather than assuming it — a row is
 * matched only when its cell count equals the header's column count and the
 * Svelte block guards around each cell are the same as those around the
 * corresponding head. A row that spans columns (`colspan`) is not a column row
 * and is excluded; a row that is neither spanning nor matchable is itself a
 * failure, so the guard can never silently stop covering a table.
 */

const SCAN_ROOTS = ["src/features", "src/routes"];
const TABLE_BARREL = "src/lib/components/ui/table/index.ts";
const TABLE_HEAD_PRIMITIVE = "src/lib/components/ui/table/table-head.svelte";

/**
 * CSS `text-align` keywords, normalised onto the physical directions the
 * codebase writes. Both shipped locales are left-to-right and the repo spells
 * alignment physically (`text-left`/`text-right`), so a logical `text-end` is
 * the same column intent as a physical `text-right` and must not be reported
 * as a disagreement.
 */
const ALIGNMENTS: Readonly<Record<string, string>> = {
  center: "center",
  end: "right",
  justify: "justify",
  left: "left",
  right: "right",
  start: "left",
};

const CLASS_LITERAL = /(?<![\w-])class="([^"]*)"/;
const CLASS_EXPRESSION = /(?<![\w-])class=(\{(?:[^{}]|\{[^{}]*\})*\})/;
const STYLE_LITERAL = /(?<![\w-])style="([^"]*)"/;
const STRING_LITERAL = /"([^"]*)"|'([^']*)'/g;
const TEXT_ALIGN_PROPERTY = /text-align:\s*([a-z]+)/;
const CLOSING_TAG = /<\/([A-Z][\w.]*)\s*>/g;
/** `{#if …}`, `{:else …}`, `{/if}` — the block boundaries, not `{@const}`. */
const BLOCK_BOUNDARY = /\{([#:/])([a-z]+)/g;
const SCRIPT_OR_STYLE = /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/g;
/** A prop switching classes on: `numeric && "justify-end text-right"`. */
const PROP_AND_CLASSES = /([A-Za-z_$][\w$]*)\s*&&\s*"([^"]*)"/g;
/** A prop choosing between classes: `numeric ? "text-right" : "text-left"`. */
const PROP_TERNARY_CLASSES =
  /([A-Za-z_$][\w$]*)\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/g;

/** The `text-align` a class list declares, or undefined if it declares none. */
function alignmentOfClasses(classes: string): string | undefined {
  for (const token of classes.split(/\s+/)) {
    const keyword = /^text-([a-z]+)$/.exec(token)?.[1];
    if (keyword && keyword in ALIGNMENTS) return ALIGNMENTS[keyword];
  }
  return undefined;
}

function stringLiterals(expression: string): string[] {
  const found: string[] = [];
  for (const match of expression.matchAll(STRING_LITERAL)) {
    const value = match[1] ?? match[2];
    if (value) found.push(value);
  }
  return found;
}

/** Every class list an element declares, literal or interpolated. */
function declaredClasses(attributes: string): string[] {
  const literal = CLASS_LITERAL.exec(attributes)?.[1];
  if (literal !== undefined) return [literal];
  const expression = CLASS_EXPRESSION.exec(attributes)?.[1];
  return expression ? stringLiterals(expression) : [];
}

/**
 * Blank out script and style bodies, keeping every offset, so a regular
 * expression literal or a TypeScript generic in the script cannot be read as
 * markup or as a Svelte block boundary.
 */
function markupOnly(source: string): string {
  return source.replace(
    SCRIPT_OR_STYLE,
    (_whole, open: string, _tag: string, body: string, close: string) =>
      `${open}${" ".repeat(body.length)}${close}`,
  );
}

function resolveModule(filename: string, module: string): string {
  const resolved = module.startsWith("@/")
    ? `src/${module.slice(2)}`
    : module.startsWith("#lib/")
      ? `src/lib/${module.slice(5)}`
      : module.startsWith(".")
        ? path.posix.join(path.posix.dirname(filename), module)
        : module;
  return resolved.replace(/\.js$/, "").replace(/\/index$/, "/index.ts");
}

/** Local name -> resolved module, including `import * as Table`. */
function importsOf(filename: string, source: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const [, clause, module] of source.matchAll(
    /import\s+([^;]*?)\s+from\s+["']([^"']+)["']/g,
  )) {
    const target = resolveModule(filename, module);
    const text = clause.trim();
    const namespace = /^\*\s+as\s+([\w$]+)$/.exec(text);
    if (namespace) {
      imports.set(namespace[1], target);
      continue;
    }
    const direct = /^([\w$]+)$/.exec(text);
    if (direct) {
      imports.set(direct[1], target);
      continue;
    }
    const braced = /^\{([^}]*)\}$/.exec(text);
    for (const entry of braced?.[1].split(",") ?? []) {
      const named = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(entry.trim());
      if (named) imports.set(named[2] ?? named[1], target);
    }
  }
  return imports;
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

const sources = new Map<string, string>();
async function sourceOf(filename: string): Promise<string> {
  const cached = sources.get(filename);
  if (cached !== undefined) return cached;
  const text = await readFile(filename, "utf8");
  sources.set(filename, text);
  return text;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/*
 * ---------------------------------------------------------------------------
 * The table element roles, read out of the `ui/table` barrel.
 * ---------------------------------------------------------------------------
 */

/** Primitive file basename -> the role it plays in a table. */
const ROLES: Readonly<Record<string, string>> = {
  "table-body": "body",
  "table-cell": "cell",
  "table-footer": "footer",
  "table-head": "head",
  "table-header": "header",
  "table-row": "row",
  table: "root",
};

/** Barrel export name -> role, so `Head` and `TableHead` both resolve. */
async function tableRoles(): Promise<Map<string, string>> {
  const barrel = await sourceOf(TABLE_BARREL);
  const modules = new Map<string, string>();
  for (const [, local, module] of barrel.matchAll(
    /import\s+([\w$]+)\s+from\s+["']\.\/([\w-]+)\.svelte["']/g,
  ))
    modules.set(local, module);
  const roles = new Map<string, string>();
  const exported = /export\s*\{([\s\S]*?)\}/.exec(barrel)?.[1] ?? "";
  for (const entry of exported.split(",")) {
    const named = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(
      entry.replace(/\/\/.*$/gm, "").trim(),
    );
    if (!named) continue;
    const role = ROLES[modules.get(named[1]) ?? ""];
    if (role) roles.set(named[2] ?? named[1], role);
  }
  return roles;
}

const ROLE_BY_EXPORT = await tableRoles();

/** The alignment `table-head.svelte` gives every column that declares none. */
const DEFAULT_ALIGNMENT = await (async () => {
  for (const classes of stringLiterals(await sourceOf(TABLE_HEAD_PRIMITIVE))) {
    const alignment = alignmentOfClasses(classes);
    if (alignment) return alignment;
  }
  return undefined;
})();

/*
 * ---------------------------------------------------------------------------
 * The prop-driven alignment vocabulary, read out of every component's own
 * class expressions. This is what finds `CatalogTableLink`'s `numeric`.
 * ---------------------------------------------------------------------------
 */

type PropAlignment = { alignment: string; classes: string; prop: string };

/** Component file -> the props that switch a `text-align` on. */
async function propAlignments(
  files: readonly string[],
): Promise<Map<string, PropAlignment[]>> {
  const found = new Map<string, PropAlignment[]>();
  for (const file of files) {
    const source = await sourceOf(file);
    const discovered: PropAlignment[] = [];
    const record = (prop: string, classes: string) => {
      const alignment = alignmentOfClasses(classes);
      if (alignment) discovered.push({ alignment, classes, prop });
    };
    for (const [, prop, classes] of source.matchAll(PROP_AND_CLASSES))
      record(prop, classes);
    for (const [, prop, whenTrue, whenFalse] of source.matchAll(
      PROP_TERNARY_CLASSES,
    )) {
      record(prop, whenTrue);
      record(prop, whenFalse);
    }
    if (discovered.length) found.set(file, discovered);
  }
  return found;
}

/*
 * ---------------------------------------------------------------------------
 * A structural parse: component elements, nesting, and the Svelte blocks that
 * guard them.
 * ---------------------------------------------------------------------------
 */

type Element = {
  attributes: string;
  /** Enclosing `{#if}`/`{#each}` block texts, outermost first. */
  blocks: string[];
  children: Element[];
  index: number;
  tag: string;
};

type Boundary =
  | {
      attributes: string;
      index: number;
      kind: "open";
      selfClosing: boolean;
      tag: string;
    }
  | { index: number; kind: "close"; tag: string }
  | { index: number; kind: "block"; marker: string; text: string };

/** The index of the `}` closing the brace that opens at `start`. */
function braceEnd(text: string, start: number): number {
  let depth = 0;
  for (let cursor = start; cursor < text.length; cursor += 1) {
    if (text[cursor] === "{") depth += 1;
    else if (text[cursor] === "}") {
      depth -= 1;
      if (!depth) return cursor;
    }
  }
  return -1;
}

function boundaries(markup: string): Boundary[] {
  const found: Boundary[] = [];
  for (const element of componentTags(markup)) {
    const end =
      element.index + 1 + element.tag.length + element.attributes.length;
    found.push({
      attributes: element.attributes,
      index: element.index,
      kind: "open",
      selfClosing: markup[end] === "/",
      tag: element.tag,
    });
  }
  for (const match of markup.matchAll(CLOSING_TAG))
    found.push({ index: match.index, kind: "close", tag: match[1] });
  for (const match of markup.matchAll(BLOCK_BOUNDARY)) {
    const end = braceEnd(markup, match.index);
    if (end < 0) continue;
    found.push({
      index: match.index,
      kind: "block",
      marker: match[1],
      text: markup.slice(match.index, end + 1),
    });
  }
  return found.sort((left, right) => left.index - right.index);
}

function parse(source: string): Element {
  const markup = markupOnly(source);
  const root: Element = {
    attributes: "",
    blocks: [],
    children: [],
    index: 0,
    tag: "#document",
  };
  const open: Element[] = [root];
  const blocks: string[] = [];
  for (const boundary of boundaries(markup)) {
    if (boundary.kind === "block") {
      if (boundary.marker === "#") blocks.push(boundary.text);
      else if (boundary.marker === "/") blocks.pop();
      else if (blocks.length)
        // `{:else}` is a different branch of the same block, not a new one.
        blocks[blocks.length - 1] += boundary.text;
      continue;
    }
    if (boundary.kind === "open") {
      const element: Element = {
        attributes: boundary.attributes,
        blocks: [...blocks],
        children: [],
        index: boundary.index,
        tag: boundary.tag,
      };
      open[open.length - 1].children.push(element);
      if (!boundary.selfClosing) open.push(element);
      continue;
    }
    for (let depth = open.length - 1; depth > 0; depth -= 1)
      if (open[depth].tag === boundary.tag) {
        open.length = depth;
        break;
      }
  }
  return root;
}

/** Descendants of `element`, without descending into a nested table root. */
function* descendants(
  element: Element,
  roleOf: (tag: string) => string | undefined,
): Generator<Element> {
  for (const child of element.children) {
    yield child;
    if (roleOf(child.tag) === "root") continue;
    yield* descendants(child, roleOf);
  }
}

function* everyElement(element: Element): Generator<Element> {
  for (const child of element.children) {
    yield child;
    yield* everyElement(child);
  }
}

/*
 * ---------------------------------------------------------------------------
 * Tables, and the alignment each head and cell declares.
 * ---------------------------------------------------------------------------
 */

type Declaration = { alignment: string; how: string };
type Column = {
  declaration?: Declaration;
  element: Element;
  file: string;
  line: number;
};
type BodyRow = {
  cells: Column[];
  file: string;
  line: number;
  spanning: boolean;
};
type Table = {
  file: string;
  headerRows: number;
  heads: Column[];
  line: number;
  rows: BodyRow[];
  sections: string[];
};

const aligned = await propAlignments(
  (await Promise.all(SCAN_ROOTS.map(svelteFiles))).flat(),
);

/**
 * What a head or cell declares about its column's alignment, and in which
 * vocabulary: its own class, its own inline style, or a prop handed to a
 * component that turns the prop into an alignment class.
 */
function declarationOf(
  column: Element,
  imports: Map<string, string>,
  roleOf: (tag: string) => string | undefined,
): Declaration | undefined {
  for (const classes of declaredClasses(column.attributes)) {
    const alignment = alignmentOfClasses(classes);
    if (alignment)
      return {
        alignment,
        how: `its own \`${/^text-[a-z]+$/.test(classes) ? classes : (classes.split(/\s+/).find((token) => /^text-[a-z]+$/.test(token) && alignmentOfClasses(token)) ?? classes)}\` class`,
      };
  }
  const style = STYLE_LITERAL.exec(column.attributes)?.[1];
  const keyword = style ? TEXT_ALIGN_PROPERTY.exec(style)?.[1] : undefined;
  if (keyword && keyword in ALIGNMENTS)
    return {
      alignment: ALIGNMENTS[keyword],
      how: `its own inline \`text-align: ${keyword}\``,
    };
  for (const child of descendants(column, roleOf)) {
    const module = imports.get(child.tag);
    for (const candidate of aligned.get(module ?? "") ?? []) {
      if (
        !new RegExp(`(^|\\s)${candidate.prop}(\\s|=|$)`).test(child.attributes)
      )
        continue;
      return {
        alignment: candidate.alignment,
        how:
          `\`${candidate.prop}\` on <${child.tag}>, which ` +
          `${module} expands to \`${candidate.classes}\``,
      };
    }
  }
  return undefined;
}

async function tablesOf(file: string): Promise<Table[]> {
  const source = await sourceOf(file);
  if (!source.includes("<Table")) return [];
  const imports = importsOf(file, source);
  const roleOf = (tag: string) => {
    const [namespace, member] = tag.split(".");
    const module = imports.get(namespace);
    if (module !== TABLE_BARREL) return undefined;
    return ROLE_BY_EXPORT.get(member ?? namespace);
  };
  const tree = parse(source);
  const tables: Table[] = [];
  for (const root of everyElement(tree)) {
    if (roleOf(root.tag) !== "root") continue;
    const sections = [...descendants(root, roleOf)].filter((element) =>
      ["body", "footer", "header"].includes(roleOf(element.tag) ?? ""),
    );
    const heads: Column[] = [];
    const rows: BodyRow[] = [];
    let headerRows = 0;
    const columnsOf = (row: Element, inFile: string, inSource: string) =>
      [...descendants(row, roleOf)]
        .filter((element) =>
          ["cell", "head"].includes(roleOf(element.tag) ?? ""),
        )
        .map((element) => ({
          declaration: declarationOf(element, imports, roleOf),
          element,
          file: inFile,
          line: lineOf(inSource, element.index),
        }));
    for (const section of sections)
      for (const row of descendants(section, roleOf)) {
        if (roleOf(row.tag) !== "row") continue;
        if (roleOf(section.tag) === "header") {
          const columns = columnsOf(row, file, source);
          if (
            columns.some((column) =>
              /(^|\s)colspan[=\s]/.test(column.element.attributes),
            )
          )
            continue;
          headerRows += 1;
          heads.push(...columns);
          continue;
        }
        const cells = columnsOf(row, file, source);
        rows.push({
          cells,
          file,
          line: lineOf(source, row.index),
          spanning: cells.some((cell) =>
            /(^|\s)colspan[=\s]/.test(cell.element.attributes),
          ),
        });
      }
    // A table whose body rows are an extracted row component: follow it.
    if (headerRows === 1)
      for (const section of sections) {
        if (roleOf(section.tag) === "header") continue;
        for (const child of descendants(section, roleOf)) {
          const module = imports.get(child.tag);
          if (!module?.endsWith(".svelte")) continue;
          const rowSource = await sourceOf(module);
          const rowImports = importsOf(module, rowSource);
          const rowRoleOf = (tag: string) => {
            const [namespace, member] = tag.split(".");
            if (rowImports.get(namespace) !== TABLE_BARREL) return undefined;
            return ROLE_BY_EXPORT.get(member ?? namespace);
          };
          for (const element of descendants(parse(rowSource), rowRoleOf)) {
            if (rowRoleOf(element.tag) !== "row") continue;
            const cells = [...descendants(element, rowRoleOf)]
              .filter((node) =>
                ["cell", "head"].includes(rowRoleOf(node.tag) ?? ""),
              )
              .map((node) => ({
                declaration: declarationOf(node, rowImports, rowRoleOf),
                element: node,
                file: module,
                line: lineOf(rowSource, node.index),
              }));
            rows.push({
              cells,
              file: module,
              line: lineOf(rowSource, element.index),
              spanning: cells.some((cell) =>
                /(^|\s)colspan[=\s]/.test(cell.element.attributes),
              ),
            });
          }
        }
      }
    tables.push({
      file,
      headerRows,
      heads,
      line: lineOf(source, root.index),
      rows,
      sections: [...new Set(sections.map((s) => roleOf(s.tag) ?? ""))].sort(),
    });
  }
  return tables;
}

const tables = (
  await Promise.all(
    (await Promise.all(SCAN_ROOTS.map(svelteFiles))).flat().map(tablesOf),
  )
).flat();

/**
 * Tables with no header row: their `Table.Head` elements are row headers
 * inside the body, labelling a row rather than a column, so there is no column
 * header sequence to compare a body row against. Each pin records the table's
 * literal section structure, re-read every run: give one of these a
 * `Table.Header` and the pin goes stale and must be deleted, and a new
 * header-less table is a failure rather than a line of configuration.
 */
const ROW_HEADER_TABLES: readonly { file: string; sections: string }[] = [
  {
    file: "src/features/homeworks/components/HomeworkDetailSecondaryDetails.svelte",
    sections: "body",
  },
  {
    file: "src/features/workspace/components/BusTabRoutesTable.svelte",
    sections: "body",
  },
  {
    file: "src/features/workspace/components/TodoDetailDialog.svelte",
    sections: "body",
  },
];

/** The column tables: a single header row defines the column sequence. */
const columnTables = tables.filter((table) => table.headerRows === 1);

/** Guard chains relative to the blocks every column in the sequence shares. */
function relativeBlocks(columns: readonly Column[]): string[][] {
  if (!columns.length) return [];
  let shared = columns[0].element.blocks.length;
  for (const column of columns) {
    let depth = 0;
    while (
      depth < shared &&
      column.element.blocks[depth] === columns[0].element.blocks[depth]
    )
      depth += 1;
    shared = depth;
  }
  return columns.map((column) => column.element.blocks.slice(shared));
}

type Match = { cell: Column; head: Column; index: number };

/** Rows the guard could pair with the header, and rows it could not. */
const matched: { row: BodyRow; table: Table; pairs: Match[] }[] = [];
const unmatchable: string[] = [];
for (const table of columnTables) {
  const headBlocks = relativeBlocks(table.heads);
  for (const row of table.rows) {
    if (row.spanning) continue;
    if (row.cells.length !== table.heads.length) {
      unmatchable.push(
        `${row.file}:${row.line} has ${row.cells.length} cells but the ` +
          `header row of the table at ${table.file}:${table.line} defines ` +
          `${table.heads.length} columns, and no cell spans. Column N of the ` +
          `body no longer sits under column N of the header, so neither this ` +
          `guard nor a reader can say what each cell is aligned against. ` +
          `Give the row one cell per column, or let the odd row span with ` +
          `\`colspan\`.`,
      );
      continue;
    }
    const cellBlocks = relativeBlocks(row.cells);
    const diverged = headBlocks.findIndex(
      (blocks, index) =>
        blocks.join("\u0000") !== cellBlocks[index].join("\u0000"),
    );
    if (diverged >= 0) {
      unmatchable.push(
        `${row.file}:${row.line} column ${diverged + 1} sits inside ` +
          `${cellBlocks[diverged].join(" ") || "no block"} while its header at ` +
          `${table.heads[diverged].file}:${table.heads[diverged].line} sits ` +
          `inside ${headBlocks[diverged].join(" ") || "no block"}. The two ` +
          `sequences are conditioned differently, so column N of the body is ` +
          `not column N of the header. Guard the head and the cell with the ` +
          `same condition.`,
      );
      continue;
    }
    matched.push({
      pairs: row.cells.map((cell, index) => ({
        cell,
        head: table.heads[index],
        index,
      })),
      row,
      table,
    });
  }
}

describe("ui.table-column-alignment", () => {
  it("derives the table vocabulary from the primitives themselves", () => {
    // A rename or a moved file must break discovery loudly rather than quietly
    // emptying the rule.
    expect(ROLE_BY_EXPORT.get("Head")).toBe("head");
    expect(ROLE_BY_EXPORT.get("TableHead")).toBe("head");
    expect(ROLE_BY_EXPORT.get("Cell")).toBe("cell");
    expect(ROLE_BY_EXPORT.get("Root")).toBe("root");
    expect(
      new Set(ROLE_BY_EXPORT.values()),
      "every table role resolved from the barrel",
    ).toEqual(new Set(Object.values(ROLES)));
    expect(
      DEFAULT_ALIGNMENT,
      `the alignment ${TABLE_HEAD_PRIMITIVE} gives an undeclared column`,
    ).toBe("left");
  });

  it("discovers the prop-driven alignment vocabulary from source", () => {
    const link = aligned.get(
      "src/features/catalog/components/CatalogTableLink.svelte",
    );
    const numeric = link?.find((entry) => entry.prop === "numeric");
    expect(
      numeric,
      "CatalogTableLink's numeric prop, found by reading its class expression",
    ).toBeDefined();
    expect(numeric?.alignment).toBe("right");
    expect(numeric?.classes).toContain("text-right");
  });

  it("enumerates every table under features and routes", () => {
    expect(tables.length, "Table.Root elements discovered").toBeGreaterThan(25);
    expect(
      columnTables.length,
      "tables whose header row defines a column sequence",
    ).toBeGreaterThan(22);
    expect(
      columnTables.every((table) => table.heads.length > 0),
      "every column table has heads",
    ).toBe(true);
    expect(
      columnTables.filter((table) => !table.rows.length).map((t) => t.file),
      "every column table resolves body rows, following extracted row components",
    ).toEqual([]);
  });

  it("keeps every row-header pin matching its source", () => {
    const headerless = tables.filter((table) => !table.headerRows);
    const stale: string[] = [];
    for (const entry of ROW_HEADER_TABLES) {
      const matching = headerless.filter(
        (table) =>
          table.file === entry.file &&
          table.sections.join("+") === entry.sections,
      );
      if (matching.length !== 1)
        stale.push(
          `${entry.file} no longer holds exactly one table with sections ` +
            `"${entry.sections}" and no header row (found ${matching.length}). ` +
            `If it gained a Table.Header its columns are now gated — delete ` +
            `this pin.`,
        );
    }
    expect(stale, "row-header pins must track the source").toEqual([]);
    const pinned = new Set(ROW_HEADER_TABLES.map((entry) => entry.file));
    expect(
      headerless
        .filter((table) => !pinned.has(table.file))
        .map((t) => `${t.file}:${t.line}`),
      "a table with no Table.Header has no column headers to gate; give it " +
        "one rather than pinning it",
    ).toEqual([]);
  });

  it("matches every body row to the header row positionally", () => {
    expect(unmatchable, "rows the guard cannot pair with their header").toEqual(
      [],
    );
    expect(
      columnTables
        .filter((table) => !matched.some((match) => match.table === table))
        .map((table) => `${table.file}:${table.line}`),
      "every column table has body rows paired column-for-column with its header, including tables with spanning controls or empty-state rows",
    ).toEqual([]);
  });

  it("aligns each column's header and body cells", () => {
    const offenders: string[] = [];
    for (const { pairs, table } of matched)
      for (const { cell, head, index } of pairs) {
        const headAlignment = head.declaration?.alignment ?? DEFAULT_ALIGNMENT;
        const cellAlignment = cell.declaration?.alignment ?? DEFAULT_ALIGNMENT;
        if (headAlignment === cellAlignment) continue;
        const headHow = head.declaration
          ? `declares ${headAlignment} via ${head.declaration.how}`
          : `declares nothing, so it keeps the shared ${DEFAULT_ALIGNMENT} default`;
        const cellHow = cell.declaration
          ? `declares ${cellAlignment} via ${cell.declaration.how}`
          : `declares nothing, so it keeps the shared ${DEFAULT_ALIGNMENT} default`;
        offenders.push(
          `${table.file}:${table.line} column ${index + 1}: the header at ` +
            `${head.file}:${head.line} ${headHow}, but the body cell at ` +
            `${cell.file}:${cell.line} ${cellHow}. The column's text sits ` +
            `under a heading aligned the other way. Make both sides say ` +
            `${headAlignment === DEFAULT_ALIGNMENT ? cellAlignment : headAlignment}, ` +
            `or neither.`,
        );
      }
    expect(offenders, "columns whose header and body disagree").toEqual([]);
  });
});
