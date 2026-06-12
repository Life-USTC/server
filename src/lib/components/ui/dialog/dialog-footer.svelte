<script lang="ts">
let className = "";

export { className as class };
</script>

<div class={`sticky bottom-0 flex justify-end gap-2 border-base-300 border-t bg-base-100 px-5 py-4 ${className}`} data-slot="dialog-footer" {...$$restProps}>
  <slot />
</div>
