<script lang="ts">
let className = "";

export { className as class };
</script>

<div class={`grid gap-1.5 p-5 ${className}`} data-slot="card-header" {...$$restProps}>
  <slot />
</div>
