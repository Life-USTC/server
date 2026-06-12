<script lang="ts">
let className = "";

export { className as class };
</script>

<span
  class={`relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-base-300 bg-base-200 ${className}`}
  data-slot="avatar"
  {...$$restProps}
>
  <slot />
</span>
