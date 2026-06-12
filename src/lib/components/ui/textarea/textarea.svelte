<script lang="ts">
export let disabled = false;
export let placeholder = "";
export let value = "";
let className = "";

export { className as class };
</script>

<textarea
  bind:value
  class={`min-h-24 w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-base-content/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  data-slot="textarea"
  {disabled}
  {placeholder}
  {...$$restProps}
></textarea>
