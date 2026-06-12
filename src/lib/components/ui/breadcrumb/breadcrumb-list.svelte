<script lang="ts">
let className = "";

export { className as class };
</script>

<ol
  class={`flex flex-wrap items-center gap-1.5 text-base-content/60 text-sm ${className}`}
  data-slot="breadcrumb-list"
  {...$$restProps}
>
  <slot />
</ol>
