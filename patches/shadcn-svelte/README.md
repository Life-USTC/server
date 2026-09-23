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

The `$UTILS$` → `$lib/utils` line in each patch is the registry's own
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
