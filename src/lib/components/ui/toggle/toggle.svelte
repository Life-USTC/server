<script lang="ts">
export let pressed = false;
let className = "";

export { className as class };
</script>

<button
  aria-pressed={pressed}
  class={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-base-300 bg-base-100 px-3 font-medium text-sm shadow-sm transition hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-50 ${pressed ? "bg-base-200 text-base-content shadow-sm" : ""} ${className}`}
  data-slot="toggle"
  type="button"
  {...$$restProps}
>
  <slot />
</button>
