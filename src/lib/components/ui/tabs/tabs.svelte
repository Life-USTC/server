<script lang="ts">
let className = "";

export { className as class };
</script>

<div class={`grid min-w-0 gap-4 ${className}`} data-slot="tabs" {...$$restProps}>
  <slot />
</div>
