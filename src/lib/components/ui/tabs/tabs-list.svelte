<script lang="ts">
let className = "";

export { className as class };
</script>

<div
  class={`inline-flex max-w-full w-fit items-center gap-1 overflow-x-auto rounded-xl border border-base-300 bg-base-100 p-1 ${className}`}
  data-slot="tabs-list"
  role="tablist"
  {...$$restProps}
>
  <slot />
</div>
