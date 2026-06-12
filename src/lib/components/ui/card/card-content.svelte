<script lang="ts">
let className = "";

export { className as class };
</script>

<div
  class={`min-w-0 p-5 pt-0 ${className}`}
  data-slot="card-content"
  {...$$restProps}
>
  <slot />
</div>
