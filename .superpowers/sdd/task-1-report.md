# Task 1 Report: Generate the Usage Audit Report

## Status

Completed. Review fixes applied.

## Summary

Implemented `scripts/audit-shadcn-classes.ts` to scan the Life@USTC SvelteKit codebase for `class` and `style` attributes applied to shadcn-svelte component tags. The script produces a JSON audit report at `docs/superpowers/artifacts/shadcn-class-audit.json` that will serve as the baseline for the raw-usage cleanup.

## Fixes Applied (Post-Review)

1. **Import order** — Reordered imports so Biome's `organizeImports` rule passes.
2. **Trailing newline** — The generated JSON now ends with `\n`.
3. **Undeclared dependency** — Replaced `fast-glob` with `Bun.Glob` plus an explicit skip of `src/lib/components/ui/**`; `fast-glob` was not added to `package.json`.
4. **Svelte `class:` directives** — The AST walker now also collects `ClassDirective` nodes on shadcn component tags and reports them in a new `classDirective` field. Entries with directives are marked `isConditional: true`.

## Implementation

The script:

1. Lists installed shadcn components from `src/lib/components/ui`.
2. Scans `src/**/*.{svelte,ts,js}` excluding `src/lib/components/ui/**` (component internals are not usage).
3. Parses imports from `$lib/components/ui/<component>/index.js`, handling:
   - Named imports: `import { Button } from "..."`
   - Aliased imports: `import { Button as Btn } from "..."`
   - Namespace imports: `import * as Card from "..."`
4. For `.svelte` files, uses the Svelte 5 compiler AST to robustly find component tags and extract `class`/`style` attributes, including multiline and nested-brace expressions like `class={cn("...", condition ? "..." : "...")}`.
5. For `.ts`/`.js` files, falls back to a line-based regex scan.
6. Detects conditional class/style values by inspecting the Svelte AST for `ConditionalExpression` and `LogicalExpression` nodes (and their presence inside `cn(...)` calls).
7. Writes a JSON array with one entry per usage.

## Output Fields

Each audit entry includes:

- `file` — relative path to the source file
- `line` / `column` — 1-based location of the component tag
- `componentImport` — the `$lib/components/ui/...` import path
- `tag` — the tag as written, e.g. `<Card.Root`
- `component` — the shadcn component directory name, e.g. `card`
- `subComponent` — the subcomponent part when using namespace imports, e.g. `Root`
- `classValue` — raw `class` attribute value, or `null`
- `styleValue` — raw `style` attribute value, or `null`
- `classDirective` — raw Svelte `class:` directive source (space-joined when multiple), or `null`
- `isConditional` — `true` if the class/style expression contains a conditional or logical expression, or if a `class:` directive is present

The output intentionally covers both the brief's requested fields (`componentImport`, `isConditional`) and the user-description fields (`component`, `subComponent`).

## Verification

Ran the script with Bun:

```bash
bun run scripts/audit-shadcn-classes.ts
```

Output:

```text
Audited 707 class/style usages across 1648 files.
```

The baseline report contains 707 entries. Sample entries:

```json
{
  "file": "src/routes/_components/LegalDocument.svelte",
  "line": 13,
  "column": 1,
  "componentImport": "$lib/components/ui/card/index.js",
  "tag": "<Card.Root",
  "component": "card",
  "subComponent": "Root",
  "classValue": "\"mx-auto w-full max-w-3xl\"",
  "styleValue": null,
  "classDirective": null,
  "isConditional": false
}
```

```json
{
  "file": "src/features/dashboard/components/BusTabRouteTable.svelte",
  "line": 46,
  "column": 5,
  "componentImport": "$lib/components/ui/table/index.js",
  "tag": "<Table.Row",
  "component": "table",
  "subComponent": "Row",
  "classValue": "{cn(\n                \"border-0\",\n                trip.status === \"departed\" ? \"opacity-60\" : undefined,\n                isNextTrip ? \"bg-muted/70 hover:bg-muted\" : undefined,\n              )}",
  "styleValue": null,
  "classDirective": null,
  "isConditional": true
}
```

Code quality checks passed:

```bash
bunx biome check scripts/audit-shadcn-classes.ts docs/superpowers/artifacts/shadcn-class-audit.json
bunx biome check src/features src/routes src/lib/components
```

Both completed with no errors.

The generated artifact ends with a newline and contains the new `classDirective` field on every entry.

## Files Created

- `scripts/audit-shadcn-classes.ts`
- `docs/superpowers/artifacts/shadcn-class-audit.json`

## Commit

```text
01ecf21d chore: add shadcn class/style audit script and baseline report
f6bae2f2 fix(audit): import order, trailing newline, built-in glob, class directives
```

## Notes

- The user description asked for output fields `component` and `subComponent`; the brief asked for `componentImport` and `isConditional`. The report includes all of these fields so both specifications are satisfied.
- The scan excludes `src/lib/components/ui/**` because the goal is to audit application usage of shadcn components, not the component definitions themselves.
