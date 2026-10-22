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

Removes `tabindex={-1}` and adds a `focus-visible` ring.

Upstream marks this rail `tabindex={-1}`, which takes a `<button>` carrying
`aria-label="Toggle Sidebar"` out of the tab order. Between 768px and 1023px it
was the only remaining sidebar toggle, so keyboard users had no way to expand
the sidebar and read navigation labels (#869). The ring gives the now-focusable
control a visible focus state.

Covered by the tablet keyboard tests in `tests/e2e/src/app/test.ts`, which
should fail if a registry refresh reverts this.

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

### `button.patch`, `badge.patch`, `alert.patch`

All three swap a role colour used as text for its `-text` counterpart: the
`link` variant's `text-primary`, and the `destructive` variant's
`text-destructive`.

`--primary` is the brand teal, calibrated as a *surface* against
`--primary-foreground`. The `link` variant is the one variant that is never a
filled surface, so upstream's `text-primary` always lands on the page
background: `#00c3d0` on white is 2.16:1, far below the 4.5:1 WCAG AA minimum,
and no font size rescues it. `--primary-text` is the same hue at L 0.5 (5.3:1
on white, 4.6:1 on the lightest surface in the ramp) and aliases `--primary`
again in dark mode, where the teal already reaches 11.2:1. Fixing it in the
variant rather than at the call sites keeps the next `variant="link"` correct
by default.

The `destructive` variants are the stock soft-destructive pairing, red text on
a 10% tint of itself: `#dc2626` on `#fce9e9` is 4.14:1, and the alert's
`text-destructive/90` on the card is 4.32:1. `--destructive-text` is the same
hue at L 0.5, giving 5.67:1 and 5.72:1, and aliases `--destructive` in dark
mode, where the tint is `/20` on a dark surface and already clears AA.
`text-destructive` stays stock wherever it sits on a plain card — 4.83:1 —
so `field-error` and `dropdown-menu-item` need no divergence.

The button and badge files already carried local divergence that predates this
change — the first-party `status-*` badge variants, the `[a]:hover` scoping,
and the minimum touch target in the button base — so these patches record that
too.

Covered by `color-contrast` in `tests/e2e/utils/ui-quality.ts`, which fails on
these variants across the page inventory if a registry refresh reverts them.

## input

`input.patch` — the file-type branch must not `bind:value`: a file input only
accepts an empty programmatic value, and the binding plus attribute spread
replays the stale bound filename into the element on re-render, throwing
`InvalidStateError` and unmounting the surrounding tree (first seen crashing
the comment composer's pending-upload UI after the SvelteKit 3 migration).
