<script lang="ts">
let className = "";

export { className as class };
</script>

<div
  class={`min-w-0 rounded-xl border border-base-300 bg-base-100 shadow-sm ${className}`}
  data-slot="card"
  {...$$restProps}
>
  <slot />
</div>
