<script lang="ts">
export let destructive = false;
export let disabled = false;
export let href: string | undefined = undefined;
export let radio = false;
export let checked = false;
export let rel: string | undefined = undefined;
export let target: string | undefined = undefined;
export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
let className = "";

export { className as class };
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
  <button
    class={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-base-200 ${destructive ? "text-error" : ""} ${className}`}
    data-slot="menu-item"
    data-checked={radio ? checked : undefined}
    data-radio={radio || undefined}
    {disabled}
    onclick={onclick}
    role="menuitem"
    type="button"
    {...$$restProps}
  >
    <slot />
  </button>
{/if}
