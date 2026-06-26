<script lang="ts">
export let selected = false;
export let onclick: ((event: MouseEvent) => void) | undefined = undefined;
export let semantic = false;
export let panelId: string | undefined = undefined;
export let id: string | undefined = undefined;
let className = "";

export { className as class };
</script>

<button
  aria-controls={semantic ? panelId : undefined}
  aria-pressed={semantic ? undefined : selected}
  aria-selected={semantic ? selected : undefined}
  class={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 font-medium text-sm transition hover:bg-base-200 ${selected ? "bg-base-200 text-base-content shadow-sm" : "text-base-content/65"} ${className}`}
  data-slot="tabs-button"
  {id}
  role={semantic ? "tab" : undefined}
  tabindex={semantic && !selected ? -1 : undefined}
  type="button"
  {...$$restProps}
  onclick={onclick}
>
  <slot />
</button>
