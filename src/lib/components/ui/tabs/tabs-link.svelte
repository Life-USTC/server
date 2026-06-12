<script lang="ts">
export let href: string;
export let selected = false;
export let role = "tab";
let className = "";

export { className as class };
</script>

<a
  aria-selected={selected}
  class={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 font-medium text-sm transition hover:bg-base-200 ${selected ? "bg-base-200 text-base-content shadow-sm" : "text-base-content/65"} ${className}`}
  data-slot="tabs-link"
  {href}
  {role}
  {...$$restProps}
>
  <slot />
</a>
