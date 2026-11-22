<script lang="ts">
import { cn } from "#lib/utils.js";
import CatalogDetailIcon from "./CatalogDetailIcon.svelte";

export let href: string;
export let nowrap = false;
export let numeric = false;
export let mono = false;

let className = "";

export { className as class };
</script>

<a
  class={cn(
    "table-cell-action",
    nowrap && "whitespace-nowrap",
    numeric && "tabular-nums",
    mono && "font-mono",
    className,
  )}
  {href}
>
  <CatalogDetailIcon {href} />
  <slot />
</a>
