<script lang="ts">
let className = "";

export { className as class };
</script>

<li
  aria-hidden="true"
  class={`text-base-content/40 ${className}`}
  data-slot="breadcrumb-separator"
  role="presentation"
  {...$$restProps}
>
  <slot>/</slot>
</li>
