<script lang="ts">
let className = "";

export { className as class };
</script>

<span
  class={`flex h-full w-full items-center justify-center bg-base-200 font-medium text-base-content/70 text-sm ${className}`}
  data-slot="avatar-fallback"
  {...$$restProps}
>
  <slot />
</span>
