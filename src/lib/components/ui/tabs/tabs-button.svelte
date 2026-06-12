<script lang="ts">
export let selected = false;
export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
let className = "";

export { className as class };
</script>

<button
  aria-selected={selected}
  class={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 font-medium text-sm transition hover:bg-base-200 ${selected ? "bg-base-200 text-base-content shadow-sm" : "text-base-content/65"} ${className}`}
  data-slot="tabs-button"
  role="tab"
  type="button"
  {...$$restProps}
  onclick={onclick}
>
  <slot />
</button>
