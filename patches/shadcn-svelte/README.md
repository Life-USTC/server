# shadcn-svelte divergences

Files under `src/lib/components/ui/` come from the shadcn-svelte registry
(`components.json`, style `nova`) and are periodically re-synced from it. Any
change we make there is silently reverted by the next refresh, so every
deliberate divergence is recorded here as a diff against the registry version.

## Refreshing a component

1. Re-add it from the registry as usual.
2. Apply the matching patch in this directory.
3. If a hunk no longer applies, the upstream component changed underneath it —
   read the patch header to see why the divergence exists before dropping it.
4. Regenerate the patch so it reflects the new upstream baseline:

   ```sh
   curl -s https://shadcn-svelte.com/registry/styles/nova/<component>.json \
     | jq -r '.files[] | select(.target | contains("<file>")) | .content' \
     > /tmp/upstream.svelte
   diff -u /tmp/upstream.svelte src/lib/components/ui/<path> > patches/shadcn-svelte/<file>.patch
   ```

The `$UTILS$` → `#lib/utils` line in each patch is the registry's own
placeholder substitution, not a divergence.

## Current patches

### `sidebar-rail.patch`

Removes `tabindex={-1}`, adds a `focus-visible` ring, takes the accessible name
as a `label` prop, and widens and re-places the rail so it clears 24x24 without
covering the sidebar's own controls.

Upstream marks this rail `tabindex={-1}`, which takes a `<button>` carrying
`aria-label="Toggle Sidebar"` out of the tab order. Between 768px and 1023px it
was the only remaining sidebar toggle, so keyboard users had no way to expand
the sidebar and read navigation labels (#869). The ring gives the now-focusable
control a visible focus state. A focusable control also needs a localized name,
so `aria-label`/`title` come from a required `label` prop instead of upstream's
hardcoded English.

The geometry is the other half. The sidebar container is 256px wide expanded and
48px icon-collapsed, with a 1px `border-e`, so its padding-box right edge sits at
255px / 47px. Upstream centres a 16px rail on that edge (`w-4`,
`group-data-[side=left]:-right-4`, `ltr:-translate-x-1/2`): 247-263px / 39-55px.
Widening it to `w-6` for WCAG 2.2 SC 2.5.8 keeps the same centre and pushes the
box 20px back into the sidebar — 235-259px / 27-51px — which covers the right
8px of every 24px `[data-sidebar="menu-action"]` chevron (16x24px left) and 13px
of every 32px icon-mode row (19x32px left). axe reads both as partially obscured
and fails `target-size`.

So on the left side the rail drops the half-width translate and moves out to
`-right-5`, spanning 251-275px expanded and 43-67px collapsed. The chevrons end
at 243px and the icon rows at 40px, so nothing in the sidebar is covered, and
main content's padding box starts at 276px (`sm:px-5`) / 280px (`lg:px-6`), so
the rail stays inside the gutter. `group-data-[side=left]:after:start-1` holds
the 2px hover hairline 4px in from the rail's inner edge — 255px / 47px, on the
container's own border, exactly where upstream's `after:start-1/2` drew it at
`w-4`.

The translate is now scoped to `group-data-[side=right]`, which keeps the
right-hand rail and the `collapsible=offcanvas` branches at their upstream
geometry. Neither is reachable here: the app renders one `Sidebar.Root`, with
`collapsible="icon"` and the default side. If that ever changes, note that
`group-data-[side=left]:after:start-1` and upstream's
`group-data-[collapsible=offcanvas]:after:left-full` have equal specificity, so
a left-side offcanvas sidebar would need the hairline re-scoped.

Covered by the tablet keyboard tests in `tests/e2e/src/app/test.ts`, which
should fail if a registry refresh reverts the focus contract, and by the
`target-size` rule in `tests/e2e/utils/ui-quality.ts`, which fails on every
signed-in page if a refresh reverts the geometry.

### `kbd.patch`

Replaces `text-muted-foreground` with `text-foreground/70`.

Upstream pairs the key cap's own `bg-muted` with `text-muted-foreground`, a
foreground calibrated against `--background` rather than `--muted`. On our zinc
ramp that is `#71717a` on `#f4f4f5` = 4.39:1 at 12px, under the 4.5:1 WCAG AA
minimum; `text-foreground/70` gives 5.34:1 and stays visibly lighter than body
text. Both classes are primitive defaults, so a call site cannot override the
pair without restating it everywhere `Kbd.Root` is used.

Nothing fails if a registry refresh reverts this while `color-contrast` stays
disabled in `tests/e2e/utils/ui-quality.ts`; enabling that rule puts the key
hint in the shell's search trigger back under the page-inventory audit.

## input

`input.patch` — the file-type branch must not `bind:value`: a file input only
accepts an empty programmatic value, and the binding plus attribute spread
replays the stale bound filename into the element on re-render, throwing
`InvalidStateError` and unmounting the surrounding tree (first seen crashing
the comment composer's pending-upload UI after the SvelteKit 3 migration).
