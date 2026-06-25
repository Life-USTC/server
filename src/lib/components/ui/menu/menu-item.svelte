<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

let {
  children,
  class: className,
  destructive = false,
  disabled = false,
  href = undefined,
  onclick,
  rel = undefined,
  target = undefined,
  type = "button",
  ...restProps
}: MenuPrimitive.ItemProps & {
  children?: Snippet;
  destructive?: boolean;
  href?: string;
  onclick?: (event: Event) => void;
  rel?: string;
  target?: string;
  type?: "button" | "submit";
} = $props();

const itemClass =
  "flex w-full cursor-default select-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-base-200 data-[highlighted]:bg-base-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

function handleSelect(event: Event) {
  onclick?.(event);
}
</script>

<MenuPrimitive.Item
  {disabled}
  onSelect={handleSelect}
  {...restProps}
>
  {#snippet child({ props })}
    {#if href}
      <a
        {...props}
        class={cn(itemClass, destructive && "text-error", className)}
        href={disabled ? undefined : href}
        {rel}
        {target}
      >
        {@render children?.()}
      </a>
    {:else}
      <button
        {...props}
        class={cn(itemClass, destructive && "text-error", className)}
        {disabled}
        {type}
      >
        {@render children?.()}
      </button>
    {/if}
  {/snippet}
</MenuPrimitive.Item>
