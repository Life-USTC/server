<script lang="ts">
let className = "";

export { className as class };
</script>

<div class={`grid gap-2 border-base-300 border-b px-5 py-4 ${className}`} data-slot="dialog-header" {...$$restProps}>
  <slot />
</div>
