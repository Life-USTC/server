<script lang="ts">
let className = "";

export { className as class };
</script>

<li class={`inline-flex items-center gap-1.5 ${className}`} data-slot="breadcrumb-item" {...$$restProps}>
  <slot />
</li>
