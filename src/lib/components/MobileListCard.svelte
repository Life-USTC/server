<script lang="ts">
import type { ComponentProps } from "svelte";
import * as Item from "#lib/components/ui/item/index.js";
import { cn } from "#lib/utils.js";

let {
  class: className,
  size = "sm",
  href,
  child,
  children,
  ...props
}: ComponentProps<typeof Item.Root> & { href?: string } = $props();
</script>

{#snippet link({ props }: { props: Record<string, unknown> })}
  <a {href} {...props}>{@render children?.()}</a>
{/snippet}

<Item.Root {size} class={cn("min-w-0 items-start", className)} child={href === undefined ? child : link} {children} {...props} />
