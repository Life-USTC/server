<script lang="ts">
export let disabled = false;
export let name: string | undefined = undefined;
export let placeholder = "";
export let type = "text";
export let value: string | number | null | undefined = "";
let element: HTMLInputElement | null = null;
let className = "";

export { className as class, element };
</script>

<input
  bind:this={element}
  class={`h-9 w-full rounded-lg border border-base-300 bg-base-100 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-base-content/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  data-slot="input"
  {disabled}
  {name}
  {placeholder}
  {type}
  bind:value
  {...$$restProps}
/>
