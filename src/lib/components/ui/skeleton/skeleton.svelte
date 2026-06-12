<script lang="ts">
let className = "";

export { className as class };
</script>

<div
  class={`animate-pulse rounded-lg bg-base-300/70 ${className}`}
  data-slot="skeleton"
  {...$$restProps}
></div>
