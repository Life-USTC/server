<script lang="ts">
let className = "";

export { className as class };
</script>

<div class={`grid gap-3 ${className}`} data-slot="accordion" {...$$restProps}>
  <slot />
</div>
