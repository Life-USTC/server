<script lang="ts">
export let href: string;
let className = "";

export { className as class };
</script>

<a
  class={`block h-full w-full px-3 py-2 text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset ${className}`}
  {href}
  {...$$restProps}
>
  <slot />
</a>
