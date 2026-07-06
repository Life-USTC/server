# shadcn-svelte Raw-Usage Audit & Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every shadcn-svelte component usage in `./server`, classify custom classes/CSS as layout (keep) or styling overrides (remove/convert), then remediate so components rely on built-in variants and theme tokens rather than ad-hoc styling.

**Architecture:** Use a static-analysis script to extract all shadcn component imports and `class`/`style` attributes, classify them with a documented decision matrix, then perform component-family remediation passes. Preserve layout classes; convert color/typography/surface overrides to shadcn variants or CSS variables.

**Tech Stack:** SvelteKit, shadcn-svelte (nova style, zinc base), Tailwind CSS v4, Biome, Bun.

## Global Constraints

- shadcn-svelte `class` prop is officially for **layout only** (sizing, spacing, positioning, responsive behavior).
- Never override component colors or typography with utility classes; prefer built-in `variant` props or semantic tokens (`bg-primary`, `text-muted-foreground`).
- Use `gap-*` instead of `space-y-*` / `space-x-*`.
- Use `size-*` instead of `w-* h-*` pairs.
- Use `cn()` for conditional classes.
- Do not add manual `z-index` to overlay components.
- `src/lib/components/ui` is ignored by Biome; all changes under `src/features`, `src/routes`, `src/lib/components` must pass `bun run format` and `bunx biome check`.
- Theme variables live in `src/routes/svelte.css`; keep them as the single source of truth for color.

---

## Context Discovered Before Planning

- `components.json` uses shadcn-svelte **style `nova`**, base color **zinc**, icon library **lucide**, UI alias `$lib/components/ui`.
- 40 shadcn component folders are installed under `src/lib/components/ui`; 39 are imported across the app.
- **644 imports** from `$lib/components/ui/*` appear in **275 files** (`src/features/*`, `src/routes/*`, `src/lib/components/*`).
- **596 `.svelte` lines** apply `class="..."` or `class={...}` to shadcn component tags.
- Only **1 inline style** on a shadcn component was found: `src/features/dashboard/components/BusTabRouteTable.svelte` (`Table.Root style={`min-width: ${tableMinWidth};`}`).
- Custom CSS files under `src/` (`svelte.css`, `markdown-preview.css`, `api-docs-scalar.css`) do not directly target shadcn selectors; `svelte.css` defines the project's design-token palette.
- Raw color override example: `src/features/bus/components/BusMapContent.svelte` uses `class="bg-[#f6f8fa] p-0"` on `Card.Content`.

Feasibility verdict: **strictly zero classes/CSS is impossible** (shadcn primitives have no opinion about container sizing or responsive layout). **Layout-only classes with no color/typography/surface overrides is feasible** and is the official shadcn-svelte recommendation.

---

## Task 1: Generate the Usage Audit Report

**Files:**
- Create: `scripts/audit-shadcn-classes.ts`
- Create: `docs/superpowers/artifacts/shadcn-class-audit.json`

**Interfaces:**
- Consumes: filesystem under `src/lib/components/ui` and source files under `src/features`, `src/routes`, `src/lib/components`.
- Produces: a JSON array where each entry contains `{ file, line, column, componentImport, tag, classValue, styleValue, isConditional }`.

- [ ] **Step 1: Write the audit script**

```ts
// scripts/audit-shadcn-classes.ts
import { readFile, readdir, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises"; // or use fast-glob if available
import path from "node:path";

const UI_DIR = "src/lib/components/ui";
const ROOT = ".";

async function listUiComponents(dir: string): Promise<Set<string>> {
  const names = new Set<string>();
  for await (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) names.add(entry.name);
  }
  return names;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const components = await listUiComponents(UI_DIR);
  const componentPattern = new RegExp(
    `<(${[...components].map(escapeRegExp).join("|")})\\.([A-Za-z]+)\\b`,
    "g",
  );

  const results: Array<Record<string, unknown>> = [];
  const files = [];
  for await (const file of glob("src/**/*.{svelte,ts,js}")) {
    files.push(file);
  }

  for (const file of files) {
    const source = await readFile(file, "utf-8");
    const lines = source.split("\n");
    const importMatch = source.match(
      new RegExp(`from\s+["']\\$lib/components/ui/(${[...components].map(escapeRegExp).join("|")})["']`, "g"),
    );
    if (!importMatch) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const match of line.matchAll(componentPattern)) {
        const tag = match[0];
        const classAttr = line.match(/class=(?:"([^"]*)"|\{([^}]*)\})/);
        const styleAttr = line.match(/style=(?:"([^"]*)"|\{([^}]*)\})/);
        if (classAttr || styleAttr) {
          results.push({
            file,
            line: i + 1,
            column: match.index + 1,
            tag,
            classValue: classAttr ? (classAttr[1] ?? classAttr[2]) : null,
            styleValue: styleAttr ? (styleAttr[1] ?? styleAttr[2]) : null,
          });
        }
      }
    }
  }

  await writeFile(
    "docs/superpowers/artifacts/shadcn-class-audit.json",
    JSON.stringify(results, null, 2),
  );
  console.log(`Audited ${results.length} class/style usages across ${files.length} files.`);
}

main();
```

- [ ] **Step 2: Run the audit script**

Run:
```bash
bun run scripts/audit-shadcn-classes.ts
```

Expected: A file `docs/superpowers/artifacts/shadcn-class-audit.json` is created with one entry per `class`/`style` attribute applied to a shadcn component tag.

- [ ] **Step 3: Commit the script and baseline report**

```bash
git add scripts/audit-shadcn-classes.ts docs/superpowers/artifacts/shadcn-class-audit.json
git commit -m "chore: add shadcn class/style audit script and baseline report"
```

---

## Task 2: Define the Classification Rules

**Files:**
- Create: `docs/superpowers/artifacts/shadcn-styling-decisions.md`
- Modify: `src/routes/svelte.css` only after Task 3 gap analysis

**Interfaces:**
- Consumes: `docs/superpowers/artifacts/shadcn-class-audit.json`
- Produces: documented decision matrix and a curated list of per-usage decisions.

- [ ] **Step 1: Write the decision matrix**

Create `docs/superpowers/artifacts/shadcn-styling-decisions.md` with this structure:

```markdown
# shadcn-svelte Class/Style Decision Matrix

## Allowed (Layout)

| Pattern | Example | Rationale |
|---|---|---|
| Sizing | `w-full`, `w-fit`, `min-w-0`, `max-w-md`, `h-[min(70vh,32rem)]`, `size-7` | Components have no container knowledge. |
| Spacing | `p-0`, `px-6`, `py-6`, `gap-2`, `gap-4` | Parent layout responsibility. |
| Flex/Grid layout | `flex`, `flex-col`, `items-start`, `justify-center`, `grid`, `grid-cols-2` | Parent layout responsibility. |
| Positioning | `absolute top-2 right-2`, `lg:sticky lg:top-20` | Component-agnostic layout. |
| Typography alignment | `text-center`, `text-right` | Alignment is layout, not type style. |
| Overflow/scroll | `overflow-hidden`, `min-h-24` | Layout behavior. |
| Accessibility | `sr-only` | Required for a11y, not styling. |

## Convert to Variant or Token (Styling Override)

| Pattern | Example | Action |
|---|---|---|
| Background color | `bg-[#f6f8fa]`, `bg-muted/30`, `bg-background` when used to override component surface | Use component's built-in surface or add a semantic CSS variable if the surface is intentional. |
| Border color/width | `border`, `border-l-4`, `border-border` when overriding default | Prefer `variant="outline"` or theme tokens; remove if redundant. |
| Text color/size/weight | `text-2xl`, `text-sm`, `font-medium`, `text-muted-foreground` on shadcn sub-components | Use component props or semantic tokens; remove typography overrides on `Card.Title`, `Alert.Title`, etc. |
| Radius | `rounded-lg` on components that already have radius | Remove; use theme `--radius` or a component prop if exposed. |
| Shadow | `shadow-sm` etc. | Remove; components handle elevation. |

## Inline Styles

- `style="..."` on shadcn tags is disallowed. Move to a layout wrapper or a CSS custom property.
```

- [ ] **Step 2: Classify every audited usage**

Using the audit JSON, go line-by-line and annotate each entry with:

```json
{
  "file": "src/features/bus/components/BusMapContent.svelte",
  "line": 60,
  "tag": "<Card.Content",
  "classValue": "bg-[#f6f8fa] p-0",
  "decision": "convert",
  "action": "replace bg-[#f6f8fa] with bg-background; keep p-0",
  "reason": "raw hex is a styling override; p-0 is layout"
}
```

Store the annotated list in the same `docs/superpowers/artifacts/shadcn-styling-decisions.md` file under a `## Annotated Decisions` section.

- [ ] **Step 3: Tally by component to size the work**

Produce a markdown table in the same file:

```markdown
## Remediation Tally

| Component | Usages | Convert | Keep | Review |
|---|---|---|---|---|
| Button | 125 | ~20 | ~100 | ~5 |
| Badge | 71 | ~15 | ~55 | ~1 |
| ... | ... | ... | ... | ... |
```

- [ ] **Step 4: Commit the decision matrix**

```bash
git add docs/superpowers/artifacts/shadcn-styling-decisions.md
git commit -m "docs: classify shadcn class/style usage decisions"
```

---

## Task 3: Close Theme-Token Gaps

**Files:**
- Modify: `src/routes/svelte.css`

**Interfaces:**
- Consumes: decisions from Task 2 that require new semantic tokens (e.g., a recurring surface color that is not `--background`, `--card`, `--muted`, or `--accent`).
- Produces: new CSS variables mapped into `@theme inline`.

- [ ] **Step 1: Identify token gaps from the audit**

From the annotated decisions, list every raw value or non-semantic surface that appears more than once. Examples discovered in pre-plan exploration:

- `bg-[#f6f8fa]` on `Card.Content` → already equals light-mode `--background`; use `bg-background`.
- `bg-muted/30` on cards/panels → evaluate whether a `--subtle` token is warranted.

- [ ] **Step 2: Add only necessary tokens**

Edit `src/routes/svelte.css`. If a new token is justified (appears ≥ 3 times or represents a distinct semantic surface), add it to `:root`, `.dark`, and `@theme inline`.

Example addition (only if justified):

```css
:root {
  /* existing tokens */
  --subtle: #f6f8fa;
  --subtle-foreground: #27272a;
}

.dark {
  --subtle: oklch(0.095 0.01 210);
  --subtle-foreground: oklch(0.94 0.012 210);
}

@theme inline {
  /* existing mappings */
  --color-subtle: var(--subtle);
  --color-subtle-foreground: var(--subtle-foreground);
}
```

- [ ] **Step 3: Verify CSS builds**

Run:
```bash
bun run build
```

Expected: build succeeds with no Tailwind/CSS errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/svelte.css
git commit -m "theme: add semantic tokens needed for shadcn raw usage"
```

---

## Task 4: Remediate High-Frequency Components

**Files:**
- Modify: all files importing and styling `Button`, `Badge`, `Card`, `Item`, `Empty`, `Field`, `Alert`.

**Interfaces:**
- Consumes: decision matrix and annotated audit.
- Produces: updated `.svelte` files where styling overrides are removed or converted to variants/tokens; layout classes remain.

### Task 4.1: Button

- [ ] **Step 1: Find all Button class overrides**

Run:
```bash
rg '<Button[^>]*class=' src --type svelte -n
```

- [ ] **Step 2: Apply conversion patterns**

Representative transformations:

```svelte
<!-- BEFORE -->
<Button class="border bg-transparent hover:bg-accent">Save</Button>

<!-- AFTER -->
<Button variant="outline">Save</Button>
```

```svelte
<!-- BEFORE -->
<Button class="text-destructive hover:text-destructive">Delete</Button>

<!-- AFTER -->
<Button variant="ghost" class="text-destructive hover:text-destructive">Delete</Button>
<!-- If the color override is intentional, document it in the decisions file. -->
```

```svelte
<!-- BEFORE -->
<Button class="w-full">Submit</Button>

<!-- AFTER (keep layout class) -->
<Button class="w-full">Submit</Button>
```

- [ ] **Step 3: Run Biome on changed files**

Run:
```bash
bunx biome check --write src/features src/routes src/lib/components
```

Expected: no errors.

### Task 4.2: Badge

- [ ] **Step 1: Find all Badge class overrides**

Run:
```bash
rg '<Badge[^>]*class=' src --type svelte -n
```

- [ ] **Step 2: Apply conversion patterns**

```svelte
<!-- BEFORE -->
<Badge class="mb-2" variant="secondary">Beta</Badge>

<!-- AFTER (mb-2 is layout, keep it) -->
<Badge class="mb-2" variant="secondary">Beta</Badge>
```

```svelte
<!-- BEFORE -->
<Badge class="bg-green-100 text-green-800">Active</Badge>

<!-- AFTER -->
<Badge variant="secondary">Active</Badge>
<!-- If a status color is required, add a semantic status token instead of raw green. -->
```

### Task 4.3: Card

- [ ] **Step 1: Find all Card.* class overrides**

Run:
```bash
rg '<Card\.[^>]*class=' src --type svelte -n
```

- [ ] **Step 2: Apply conversion patterns**

```svelte
<!-- BEFORE -->
<Card.Root class="bg-muted/30">
  <Card.Header class="text-center">
    <Card.Title class="text-2xl">Title</Card.Title>
  </Card.Header>
</Card.Root>

<!-- AFTER -->
<Card.Root>
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
</Card.Root>
<!-- Rationale: Card already provides surface and typography; text-center is layout and may be removed if not needed. -->
```

```svelte
<!-- BEFORE -->
<Card.Content class="bg-[#f6f8fa] p-0">

<!-- AFTER -->
<Card.Content class="bg-background p-0">
<!-- Rationale: keep p-0 (layout); replace raw hex with semantic token. -->
```

### Task 4.4: Item, Empty, Field, Alert

Repeat the same three-step pattern for each component family:

1. `rg '<Item\.[^>]*class=' src --type svelte -n`
2. Remove typography/color overrides; keep layout classes.
3. `rg '<Empty\.[^>]*class=' src --type svelte -n`
4. Remove typography/color overrides; keep layout classes.
5. `rg '<Field\.[^>]*class=' src --type svelte -n`
6. Remove typography/color overrides; keep layout classes.
7. `rg '<Alert\.[^>]*class=' src --type svelte -n`
8. Remove typography/color overrides; keep layout classes.

- [ ] **Step 3: Commit high-frequency remediation**

```bash
git add src/features src/routes src/lib/components
git commit -m "style: remove shadcn styling overrides from high-frequency components"
```

---

## Task 5: Remediate Medium-Frequency Components

**Files:**
- Modify: files using `Spinner`, `Dialog`, `ScrollArea`, `Input`, `Table`, `NativeSelect`, `ToggleGroup`, `Separator`, `Checkbox`, `ButtonGroup`, `InputGroup`, `AlertDialog`, `Textarea`, `Sidebar`, `Avatar`.

**Interfaces:**
- Consumes: decision matrix and annotated audit.
- Produces: updated `.svelte` files.

- [ ] **Step 1: Process each component family with the same rg/edit/run pattern**

For each component `X` in the list above:

```bash
rg '<X\.[^>]*class=' src --type svelte -n
```

Apply these patterns:

```svelte
<!-- BEFORE -->
<Avatar.Root class="size-7 border-0">

<!-- AFTER -->
<Avatar.Root class="size-7">
<!-- Rationale: size-7 is layout; border-0 is a styling override. -->
```

```svelte
<!-- BEFORE -->
<Table.Row class="border-l-4 border-l-green-500">

<!-- AFTER -->
<Table.Row class="border-l-4 border-l-primary">
<!-- Rationale: keep border-l-4 layout/indicator; replace raw color with semantic token. -->
```

```svelte
<!-- BEFORE -->
<Dialog.Content class="w-full max-w-md">

<!-- AFTER -->
<Dialog.Content class="w-full max-w-md">
<!-- Rationale: sizing classes are layout, keep them. -->
```

- [ ] **Step 2: Run Biome and build**

```bash
bunx biome check --write src/features src/routes src/lib/components
bun run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features src/routes src/lib/components
git commit -m "style: remove shadcn styling overrides from medium-frequency components"
```

---

## Task 6: Remediate Low-Frequency Components

**Files:**
- Modify: files using `Tooltip`, `DropdownMenu`, `Accordion`, `Skeleton`, `Toggle`, `Tabs`, `RadioGroup`, `Pagination`, `Kbd`, `Switch`, `Sheet`, `Popover`, `Label`, `InputOTP`, `Collapsible`, `Calendar`.

**Interfaces:**
- Consumes: decision matrix and annotated audit.
- Produces: updated `.svelte` files.

- [ ] **Step 1: Process each component family**

```bash
rg '<(Tooltip|DropdownMenu|Accordion|Skeleton|Toggle|Tabs|RadioGroup|Pagination|Kbd|Switch|Sheet|Popover|Label|InputOTP|Collapsible|Calendar)\.[^>]*class=' src --type svelte -n
```

Apply the same layout-vs-styling decision matrix. Pay special attention to:

```svelte
<!-- BEFORE -->
<Tabs.Content value="preview" class="m-0 min-h-32 rounded-lg border bg-background p-3">

<!-- AFTER -->
<Tabs.Content value="preview" class="min-h-32 p-3">
<!-- Rationale: m-0 can be removed if the component default is acceptable; rounded-lg/border/bg-background are surface overrides. -->
```

- [ ] **Step 2: Run Biome and build**

```bash
bunx biome check --write src/features src/routes src/lib/components
bun run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features src/routes src/lib/components
git commit -m "style: remove shadcn styling overrides from low-frequency components"
```

---

## Task 7: Remediate Custom Wrappers

**Files:**
- Modify: `src/lib/components/DateTimePicker.svelte`, `src/lib/components/MarkdownEditor.svelte`, `src/lib/components/MarkdownPreview.svelte`, `src/lib/components/PageHeader.svelte`, `src/lib/components/PageHeaderMeta.svelte`, `src/lib/components/DetailPinnedSummary.svelte`, `src/lib/components/DetailSectionNav.svelte`, `src/lib/components/calendar/*.svelte`, `src/lib/components/shell/*.svelte`, `src/routes/_components/RouteErrorCard.svelte`, `src/routes/_components/LegalDocument.svelte`.

**Interfaces:**
- Consumes: decision matrix.
- Produces: wrappers that pass only layout classes to shadcn children.

- [ ] **Step 1: Audit each wrapper file**

For each file above, list every shadcn component tag and its `class`/`style` attributes.

- [ ] **Step 2: Refactor to layout-only props**

Example for `DateTimePicker.svelte`:

```svelte
<!-- BEFORE -->
<Popover.Content class="w-auto overflow-hidden p-0" align="start">

<!-- AFTER -->
<Popover.Content class="w-auto p-0" align="start">
<!-- Rationale: w-auto and p-0 are layout; overflow-hidden is a styling override. -->
```

Example for `MarkdownEditor.svelte`:

```svelte
<!-- BEFORE -->
<Tabs.Content value="preview" class="m-0 min-h-32 rounded-lg border bg-background p-3">

<!-- AFTER -->
<Tabs.Content value="preview" class="min-h-32 p-3">
```

- [ ] **Step 3: Run Biome and build**

```bash
bunx biome check --write src/lib/components src/routes/_components
bun run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components src/routes/_components
git commit -m "style: remove shadcn styling overrides from custom wrappers"
```

---

## Task 8: Remove Inline Styles and Review Custom CSS

**Files:**
- Modify: `src/features/dashboard/components/BusTabRouteTable.svelte`
- Review: `src/lib/components/markdown-preview.css`, `src/features/api-docs/components/api-docs-scalar.css`

**Interfaces:**
- Consumes: audit findings.
- Produces: no inline styles on shadcn tags; documented CSS file decisions.

- [ ] **Step 1: Replace the Table.Root inline style**

In `src/features/dashboard/components/BusTabRouteTable.svelte`:

```svelte
<!-- BEFORE -->
<Table.Root style={`min-width: ${tableMinWidth};`}>

<!-- AFTER -->
<Table.Root class="min-w-fit" style:min-width={tableMinWidth}>
<!-- Or wrap the table in a scroll container and apply min-width to the container. -->
```

If the dynamic width is essential, use a CSS custom property on a wrapper:

```svelte
<div style="--table-min-width: {tableMinWidth}">
  <Table.Root class="min-w-[var(--table-min-width)]">
</div>
```

- [ ] **Step 2: Review markdown-preview.css and api-docs-scalar.css**

Run:
```bash
rg 'shadcn|\.button|\.badge|\.card|\.dialog' src/lib/components/markdown-preview.css src/features/api-docs/components/api-docs-scalar.css
```

Expected: no matches. If matches exist, decide whether the selectors target rendered Markdown/Scalar markup (allowed) or shadcn component classes (convert to theme tokens).

- [ ] **Step 3: Commit**

```bash
git add src/features/dashboard/components/BusTabRouteTable.svelte
git commit -m "style: remove inline style from shadcn Table.Root"
```

---

## Task 9: Add Guardrails to Prevent Regressions

**Files:**
- Modify: `biome.json`
- Create: `.github/PULL_REQUEST_TEMPLATE/shadcn-checklist.md` (optional)

**Interfaces:**
- Consumes: project linting config.
- Produces: stricter lint rules or a checklist that catches new styling overrides.

- [ ] **Step 1: Consider a custom Biome rule or grep-based CI check**

Because Biome cannot easily distinguish layout from styling overrides, add a lightweight CI script `scripts/lint-shadcn-classes.ts` that flags suspicious patterns on shadcn tags:

```ts
// scripts/lint-shadcn-classes.ts
const SUSPICIOUS = [
  /bg-\[/?!bg-(background|foreground|card|popover|primary|secondary|muted|accent|destructive|info|success|warning|sidebar|transparent|none)\b/,
  /text-\[/?!text-(foreground|card-foreground|popover-foreground|primary|primary-foreground|secondary-foreground|muted-foreground|accent-foreground|destructive-foreground|info-foreground|success-foreground|warning-foreground|sidebar-foreground)\b/,
  /border-\[/?!border-(border|input|ring|primary|secondary|destructive|info|success|warning)\b/,
  /rounded-(?!none|sm|md|lg|xl|2xl|3xl|full)\b/,
  /shadow-/,
  /font-(?!sans|serif|mono)\b/,
];

// Re-read audit output and flag lines matching SUSPICIOUS.
```

Hook it into CI in `.github/workflows/ci.yml`:

```yaml
- name: Lint shadcn class usage
  run: bun run scripts/lint-shadcn-classes.ts
```

- [ ] **Step 2: Enable Biome class sorting if not already**

Confirm `biome.json` contains:

```json
{
  "linter": {
    "rules": {
      "nursery": {
        "useSortedClasses": "error"
      }
    }
  }
}
```

It already does; no change needed unless a new rule is released that helps here.

- [ ] **Step 3: Commit**

```bash
git add biome.json scripts/lint-shadcn-classes.ts .github/workflows/ci.yml
git commit -m "ci: add shadcn class override lint guardrail"
```

---

## Task 10: Verify the Refactor

**Files:**
- All modified `.svelte`, `.ts`, `.css` files.

**Interfaces:**
- Consumes: the full set of changes.
- Produces: passing checks.

- [ ] **Step 1: Re-run the audit script**

```bash
bun run scripts/audit-shadcn-classes.ts
```

Expected: `docs/superpowers/artifacts/shadcn-class-audit.json` is updated. The count of raw styling overrides should drop to near zero.

- [ ] **Step 2: Run Biome**

```bash
bunx biome check --write src/features src/routes src/lib/components
bunx biome check src/features src/routes src/lib/components
```

Expected: final `biome check` exits 0.

- [ ] **Step 3: Run build**

```bash
bun run build
```

Expected: build succeeds.

- [ ] **Step 4: Run tests**

```bash
bun run app:prepare
# Run whichever test command the project uses, e.g.:
# bun run test
# or
# bun run test:e2e
```

Expected: tests pass. If tests depend on specific class names or visual selectors, update them to use `data-testid` attributes or stable ARIA roles instead of Tailwind class names.

- [ ] **Step 5: Final commit**

```bash
git add docs/superpowers/artifacts/shadcn-class-audit.json
git commit -m "chore: update shadcn class audit after remediation"
```

---

## Self-Review Checklist

- [ ] Spec coverage: every `class`/`style` on a shadcn component from the baseline audit is addressed.
- [ ] No placeholders: all steps contain concrete file paths, commands, and representative code.
- [ ] Type consistency: all new CSS variables are mapped in `:root`, `.dark`, and `@theme inline`.
- [ ] Feasibility: the plan targets layout-only classes + variants/tokens, which is the official shadcn-svelte recommendation; strict zero classes is explicitly ruled out.
