<script module lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { WithElementRef } from "#lib/utils.js";

  export type DivProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
  import { cn } from "#lib/utils.js";

  let { ref = $bindable(null), baseClass, class: className, children, ...props }:
    DivProps & { baseClass: string } = $props();
</script>

<div bind:this={ref} class={cn(baseClass, className)} {...props}>
  {@render children?.()}
</div>
