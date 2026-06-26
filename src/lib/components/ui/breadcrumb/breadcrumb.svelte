<script lang="ts">
let className = "";
export let label = "";

export { className as class };
</script>

<nav aria-label={label || undefined} class={className} data-slot="breadcrumb" {...$$restProps}>
  <slot />
</nav>
