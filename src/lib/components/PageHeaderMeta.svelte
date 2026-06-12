<script lang="ts">
export let label: string;
export let value: string | number;
let className = "";

export { className as class };
</script>

<div class={`rounded-md border border-base-300 bg-base-200/40 px-3 py-2 text-sm ${className}`}>
  <div class="text-base-content/60 text-xs">{label}</div>
  <div class="max-w-56 truncate font-medium">{value}</div>
</div>
