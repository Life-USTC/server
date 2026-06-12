<script lang="ts">
let className = "";

export { className as class };
</script>

<div
  class={`inline-flex items-center gap-1 rounded-xl border border-base-300 bg-base-100 p-1 ${className}`}
  data-slot="button-group"
  {...$$restProps}
>
  <slot />
</div>
