<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";

export let destructive = false;
export let href: string | undefined = undefined;
export let radio = false;
export let checked = false;
export let rel: string | undefined = undefined;
export let target: string | undefined = undefined;
export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
let className = "";

export { className as class };

function handleSelect(event: Event) {
  if (href) return;
  onclick?.(event as MouseEvent);
}
</script>

{#if href}
  <a
    class={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-base-200 ${destructive ? "text-error" : ""} ${className}`}
    data-slot="menu-item"
    {href}
    {rel}
    {target}
    onclick={onclick}
    {...$$restProps}
  >
    <slot />
  </a>
{:else}
  <MenuPrimitive.Item
    class={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-base-200 ${destructive ? "text-error" : ""} ${className}`}
    data-slot="menu-item"
    aria-checked={radio ? checked : undefined}
    onSelect={handleSelect}
    {...$$restProps}
  >
    <slot />
  </MenuPrimitive.Item>
{/if}
