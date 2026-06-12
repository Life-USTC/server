<script lang="ts">
let className = "";

export { className as class };
</script>

<span
  aria-current="page"
  class={`font-medium text-base-content ${className}`}
  data-slot="breadcrumb-page"
  {...$$restProps}
>
  <slot />
</span>
